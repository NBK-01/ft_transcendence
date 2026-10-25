import { HttpStatus } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AccessControlService } from '../access-control/access-control.service';
import { AccountType, RequestUser } from '../common/context/auth-context.types';
import { Contact, ContactStatus } from '../contacts/contact.entity';
import { ContactsService } from '../contacts/contacts.service';
import { InternalUsersService } from '../internal-users/internal-users.service';
import { ChatAccessService } from './chat-access.service';
import { ChatService } from './chat.service';
import { CHAT_SUPPORT_ACCESS_PERMISSION } from './chat.constants';
import { ConversationParticipant } from './entities/conversation-participant.entity';
import { Conversation, ConversationType } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import {
  ChatErrorCodes,
  NotConversationParticipantException,
  StaffNotConnectedException,
} from './exceptions';

/**
 * Regression guard for a real past bug: blocking a contact also cut off
 * reading the DM's history, not just sending. The rule is:
 *
 *   read / join / mark-as-read  → participant is enough, contact state doesn't matter
 *   send a new message          → participant AND a live ACCEPTED contact
 *
 * Runs the real ChatAccessService, the real ContactsService.areConnected and
 * the real ChatService over in-memory tables, so the contact is "blocked"
 * exactly the way the database records it.
 */

const ALICE = 'staff-alice';
const BOB = 'staff-bob';
const CAROL = 'staff-carol';
const CUSTOMER = 'customer-1';

const staff = (id: string): RequestUser => ({
  id,
  email: `${id}@example.com`,
  accountType: AccountType.STAFF,
});
const customer = (id: string): RequestUser => ({
  id,
  email: `${id}@example.com`,
  accountType: AccountType.CUSTOMER,
});

/** TypeORM semantics: an array `where` is OR, each object inside is AND. */
const matches = <T extends object>(
  row: T,
  where: Partial<T> | Partial<T>[],
): boolean =>
  (Array.isArray(where) ? where : [where]).some((condition) =>
    Object.entries(condition).every(
      ([key, value]) => row[key as keyof T] === value,
    ),
  );

/** How the contact between Alice and Bob ends up — `null` means removed (the row is deleted). */
type ContactState = ContactStatus | null;

function setup(contact: ContactState, supportStaff: string[] = []) {
  const contacts: Contact[] = [];
  const setContact = (state: ContactState) => {
    contacts.length = 0;
    if (state) {
      contacts.push(
        Object.assign(new Contact(), {
          id: 'contact-1',
          requesterId: ALICE,
          addresseeId: BOB,
          status: state,
        }),
      );
    }
  };
  setContact(contact);

  const dm = Object.assign(new Conversation(), {
    id: 'dm-1',
    type: ConversationType.STAFF_DM,
    participantAId: ALICE,
    participantBId: BOB,
    customerId: null,
  });
  const support = Object.assign(new Conversation(), {
    id: 'support-1',
    type: ConversationType.SUPPORT,
    customerId: CUSTOMER,
    participantAId: null,
    participantBId: null,
  });
  const conversations = [dm, support];
  const messages: Message[] = [
    Object.assign(new Message(), {
      id: 'message-1',
      conversationId: dm.id,
      senderId: ALICE,
      senderType: AccountType.STAFF,
      content: 'Said before the block',
      createdAt: new Date(),
    }),
  ];
  const readStates: Partial<ConversationParticipant>[] = [];

  const contactRepository = {
    findOne: ({ where }: { where: Partial<Contact> | Partial<Contact>[] }) =>
      Promise.resolve(contacts.find((row) => matches(row, where)) ?? null),
  };
  const conversationRepository = {
    findOne: ({ where }: { where: Partial<Conversation> }) =>
      Promise.resolve(conversations.find((row) => matches(row, where)) ?? null),
  };
  const messageRepository = {
    findAndCount: ({ where }: { where: Partial<Message> }) => {
      const found = messages.filter((row) => matches(row, where));
      return Promise.resolve([found, found.length]);
    },
    create: (values: Partial<Message>) => Object.assign(new Message(), values),
    save: (message: Message) => {
      Object.assign(message, {
        id: `message-${messages.length + 1}`,
        createdAt: new Date(),
      });
      messages.push(message);
      return Promise.resolve(message);
    },
  };
  const participantRepository = {
    upsert: (values: Partial<ConversationParticipant>) => {
      readStates.push(values);
      return Promise.resolve();
    },
  };
  const accessControl = {
    hasPermission: (userId: string, permission: string) =>
      Promise.resolve(
        permission === CHAT_SUPPORT_ACCESS_PERMISSION &&
          supportStaff.includes(userId),
      ),
  } as unknown as AccessControlService;

  const contactsService = new ContactsService(
    contactRepository as unknown as Repository<Contact>,
    {} as InternalUsersService,
    accessControl,
  );
  const access = new ChatAccessService(contactsService, accessControl);
  const chat = new ChatService(
    conversationRepository as unknown as Repository<Conversation>,
    participantRepository as unknown as Repository<ConversationParticipant>,
    messageRepository as unknown as Repository<Message>,
    access,
    contactsService,
    accessControl,
  );

  return { access, chat, dm, support, messages, readStates, setContact };
}

async function expectRefused(
  promise: Promise<unknown>,
  type:
    | typeof NotConversationParticipantException
    | typeof StaffNotConnectedException,
  code: ChatErrorCodes,
): Promise<void> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(type);
  const exception = error as NotConversationParticipantException;
  expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
  expect(exception.code).toBe(code);
}

const expectNotConnected = (promise: Promise<unknown>) =>
  expectRefused(
    promise,
    StaffNotConnectedException,
    ChatErrorCodes.StaffNotConnected,
  );
const expectNotParticipant = (promise: Promise<unknown>) =>
  expectRefused(
    promise,
    NotConversationParticipantException,
    ChatErrorCodes.NotConversationParticipant,
  );

describe('staff DM after the contact is no longer accepted', () => {
  describe.each([
    ['blocked', ContactStatus.BLOCKED],
    ['removed', null],
    ['back to pending', ContactStatus.PENDING],
  ] as const)('contact %s', (_label, state) => {
    it.each([ALICE, BOB])(
      '%s can still read the history',
      async (participant) => {
        const { chat, dm } = setup(state);

        const page = await chat.listMessages(staff(participant), dm.id, 1, 20);

        expect(page.items.map((message) => message.content)).toEqual([
          'Said before the block',
        ]);
      },
    );

    it.each([ALICE, BOB])(
      '%s can still open the conversation and mark it as read',
      async (participant) => {
        const { chat, dm, readStates } = setup(state);

        // getAuthorizedConversation is also what the WebSocket joinConversation handler calls.
        await expect(
          chat.getAuthorizedConversation(staff(participant), dm.id),
        ).resolves.toBe(dm);
        await chat.markConversationAsRead(staff(participant), dm.id);

        expect(readStates).toEqual([
          expect.objectContaining({
            conversationId: dm.id,
            participantId: participant,
          }),
        ]);
      },
    );

    it.each([ALICE, BOB])(
      '%s cannot send a new message',
      async (participant) => {
        const { chat, dm, messages } = setup(state);

        await expectNotConnected(
          chat.sendMessage(staff(participant), dm.id, 'Still there?'),
        );

        expect(messages).toHaveLength(1);
      },
    );
  });

  it('sending works again once the contact is accepted again', async () => {
    const { chat, dm, messages, setContact } = setup(ContactStatus.BLOCKED);
    await expectNotConnected(chat.sendMessage(staff(ALICE), dm.id, 'Hi'));

    setContact(ContactStatus.ACCEPTED);
    await chat.sendMessage(staff(ALICE), dm.id, 'Hi');

    expect(messages.map((message) => message.content)).toEqual([
      'Said before the block',
      'Hi',
    ]);
  });
});

describe('ChatAccessService', () => {
  describe('staff DM', () => {
    it.each([ALICE, BOB])(
      'with an accepted contact, %s can read and send',
      async (participant) => {
        const { access, dm } = setup(ContactStatus.ACCEPTED);

        await expect(
          access.assertCanAccessConversation(staff(participant), dm),
        ).resolves.toBeUndefined();
        await expect(
          access.assertCanSendMessage(staff(participant), dm),
        ).resolves.toBeUndefined();
      },
    );

    it('checks the contact whichever side sent the request', async () => {
      const { access } = setup(ContactStatus.ACCEPTED);
      const reversed = Object.assign(new Conversation(), {
        id: 'dm-2',
        type: ConversationType.STAFF_DM,
        participantAId: BOB,
        participantBId: ALICE,
      });

      await expect(
        access.assertCanSendMessage(staff(ALICE), reversed),
      ).resolves.toBeUndefined();
    });

    it.each([
      ['another staff member', staff(CAROL)],
      ['a customer', customer(CUSTOMER)],
    ])(
      '%s cannot read or send, even with support access',
      async (_label, outsider) => {
        const { access, dm } = setup(ContactStatus.ACCEPTED, [CAROL]);

        await expectNotParticipant(
          access.assertCanAccessConversation(outsider, dm),
        );
        await expectNotParticipant(access.assertCanSendMessage(outsider, dm));
      },
    );

    it('a blocked outsider gets "not a participant", not "not connected"', async () => {
      const { access, dm } = setup(ContactStatus.BLOCKED);

      await expectNotParticipant(access.assertCanSendMessage(staff(CAROL), dm));
    });
  });

  describe('support conversation', () => {
    it('the customer it belongs to can read and send', async () => {
      const { access, support } = setup(null);

      await expect(
        access.assertCanAccessConversation(customer(CUSTOMER), support),
      ).resolves.toBeUndefined();
      await expect(
        access.assertCanSendMessage(customer(CUSTOMER), support),
      ).resolves.toBeUndefined();
    });

    it('staff with support access can read and send, with no contact needed', async () => {
      const { access, support } = setup(null, [CAROL]);

      await expect(
        access.assertCanAccessConversation(staff(CAROL), support),
      ).resolves.toBeUndefined();
      await expect(
        access.assertCanSendMessage(staff(CAROL), support),
      ).resolves.toBeUndefined();
    });

    it.each([
      ['another customer', customer('customer-2')],
      ['staff without support access', staff(ALICE)],
      // Same id as the owner, but a staff account: ownership is for customers only.
      ['a staff account sharing the customer id', staff(CUSTOMER)],
    ])('%s cannot read or send', async (_label, outsider) => {
      const { access, support } = setup(null, [CAROL]);

      await expectNotParticipant(
        access.assertCanAccessConversation(outsider, support),
      );
      await expectNotParticipant(
        access.assertCanSendMessage(outsider, support),
      );
    });
  });
});
