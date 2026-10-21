import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { SendContactRequestDto } from './dto/send-contact-request.dto';
import { ListContactsQueryDto } from './dto/list-contacts-query.dto';
import { RequireStaff } from '../common/decorators/access-control.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/context/auth-context.types';

@ApiTags('Contacts')
@ApiBearerAuth()
@RequireStaff()
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @ApiOperation({ summary: 'Send a contact request to another staff member' })
  @ApiResponse({ status: 201, description: 'Request sent' })
  @ApiResponse({ status: 403, description: 'Outside your organization' })
  async sendRequest(
    @Body() dto: SendContactRequestDto,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.contactsService.sendRequest(currentUser.id, dto.addresseeId);
  }

  @Get()
  @ApiOperation({ summary: 'List my contacts' })
  async listContacts(
    @Query() query: ListContactsQueryDto,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.contactsService.listContacts(currentUser.id, query.status);
  }

  @Patch(':id/accept')
  @ApiOperation({ summary: 'Accept a pending contact request' })
  async acceptRequest(
    @Param('id') id: string,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.contactsService.acceptRequest(id, currentUser.id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a pending contact request' })
  async rejectRequest(
    @Param('id') id: string,
    @CurrentUser() currentUser: RequestUser,
  ) {
    await this.contactsService.rejectRequest(id, currentUser.id);
    return { message: 'Contact request rejected' };
  }

  @Patch(':id/block')
  @ApiOperation({ summary: 'Block a contact' })
  async blockContact(
    @Param('id') id: string,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.contactsService.blockContact(id, currentUser.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a contact or cancel a pending request' })
  async removeContact(
    @Param('id') id: string,
    @CurrentUser() currentUser: RequestUser,
  ) {
    await this.contactsService.removeContact(id, currentUser.id);
    return { message: 'Contact removed' };
  }
}
