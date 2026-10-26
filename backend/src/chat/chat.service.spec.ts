import { QueryFailedError, Repository } from 'typeorm';
import { AccessControlService } from '../access-control/access-control.service';
import { AccountType } from '../common/context/auth-context.types';
import { ContactsService } from '../contacts/contacts.service';
import { ChatAccessService } from './chat-access.service';
import { ChatService } from './chat.service';
import { ConversationParticipant } from './entities/conversation-participant.entity';
import { Conversation, ConversationType } from './entities/conversation.entity';
import { Message } from './entities/message.entity';

/**
 * The customer's standing support conversation: find-or-create, idempotent,
 * and race-safe the same way the STAFF_DM pair is (see chat-access.spec.ts
 * for the DM side) — a unique constraint on `customer_id` is the real
 * guard, and ChatService falls back to re-selecting the row on the insert
 * losing a race, rather than relying on a find-then-create check that two
 * concurrent requests could both pass.
 *
 * Runs the real ChatService over an in-memory conversation/participant
 * table that enforces that same uniqueness.
 */

const CUSTOMER = 'customer-1';
const OTHER_CUSTOMER = 'customer-2';

function setup() {
  const conversations: Conversation[] = [];
  const participants: Partial<ConversationParticipant>[] = [];
  let nextId = 1;

  const conversationRepository = {
    create: (values: Partial<Conversation>) =>
      Object.assign(new Conversation(), values),
    save: async (conversation: Conversation) => {
      await Promise.resolve(); // let a racing request interleave
      const duplicate = conversations.some(
        (row) =>
          row.type === ConversationType.SUPPORT &&
          row.customerId === conversation.customerId,
      );
      if (duplicate) {
        return Promise.reject(
          new QueryFailedError(
            'INSERT INTO "conversation"',
            [],
            Object.assign(new Error('duplicate key value (customer_id)'), {
              code: '23505',
            }),
          ),
        );
      }
      const now = new Date();
      Object.assign(conversation, {
        id: `conversation-${nextId++}`,
        createdAt: now,
        updatedAt: now,
      });
      conversations.push(conversation);
      return conversation;
    },
    findOneByOrFail: (where: Partial<Conversation>) => {
      const row = conversations.find((candidate) =>
        Object.entries(where).every(
          ([key, value]) => candidate[key as keyof Conversation] === value,
        ),
      );
      return row
        ? Promise.resolve(row)
        : Promise.reject(new Error('EntityNotFound'));
    },
  };

  const participantRepository = {
    upsert: (values: Partial<ConversationParticipant>) => {
      participants.push(values);
      return Promise.resolve();
    },
  };

  const chat = new ChatService(
    conversationRepository as unknown as Repository<Conversation>,
    participantRepository as unknown as Repository<ConversationParticipant>,
    {} as Repository<Message>,
    {} as ChatAccessService,
    {} as ContactsService,
    {} as AccessControlService,
  );

  return { chat, conversations, participants };
}

describe('getOrCreateSupportConversation', () => {
  it('creates a new support conversation for a customer with none', async () => {
    const { chat, conversations, participants } = setup();

    const conversation = await chat.getOrCreateSupportConversation(CUSTOMER);

    expect(conversation).toMatchObject({
      type: ConversationType.SUPPORT,
      customerId: CUSTOMER,
      participantAId: null,
      participantBId: null,
    });
    expect(conversations).toHaveLength(1);
    expect(participants).toEqual([
      expect.objectContaining({
        conversationId: conversation.id,
        participantId: CUSTOMER,
        participantType: AccountType.CUSTOMER,
      }),
    ]);
  });

  it('returns the same conversation on a second call — idempotent, no duplicate row', async () => {
    const { chat, conversations } = setup();
    const first = await chat.getOrCreateSupportConversation(CUSTOMER);

    const second = await chat.getOrCreateSupportConversation(CUSTOMER);

    expect(second.id).toBe(first.id);
    expect(conversations).toHaveLength(1);
  });

  it('different customers each get their own conversation', async () => {
    const { chat, conversations } = setup();

    const mine = await chat.getOrCreateSupportConversation(CUSTOMER);
    const theirs = await chat.getOrCreateSupportConversation(OTHER_CUSTOMER);

    expect(mine.id).not.toBe(theirs.id);
    expect(conversations).toHaveLength(2);
  });

  it('two near-simultaneous calls both resolve to the same conversation, not an error', async () => {
    const { chat, conversations } = setup();

    // Both inserts race past the "does it exist" instant (see the
    // interleave point in conversationRepository.save above); the real
    // uniqueness guarantee is the database's unique(customer_id)
    // constraint, which exactly one of them now hits.
    const results = await Promise.all([
      chat.getOrCreateSupportConversation(CUSTOMER),
      chat.getOrCreateSupportConversation(CUSTOMER),
    ]);

    expect(results[0].id).toBe(results[1].id);
    expect(conversations).toHaveLength(1);
  });

  it('opening it again after the participant row exists does not fail (upsert, not insert)', async () => {
    const { chat, participants } = setup();
    await chat.getOrCreateSupportConversation(CUSTOMER);

    await chat.getOrCreateSupportConversation(CUSTOMER);

    expect(participants).toHaveLength(2);
    expect(participants.every((p) => p.participantId === CUSTOMER)).toBe(true);
  });
});
