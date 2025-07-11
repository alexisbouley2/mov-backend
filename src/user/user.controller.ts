import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  Post,
} from '@nestjs/common';
import { UserService } from './user.service';
import {
  User,
  UpdateUserRequest,
  UpdateUserResponse,
  DeleteUserResponse,
  CheckContactsRequest,
  CheckContactsResponse,
} from '@movapp/types';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  findOne(@Param('id') id: string): Promise<User | null> {
    return this.userService.findOne(id);
  }

  @Post('check-contacts')
  checkContacts(
    @Body() request: CheckContactsRequest,
  ): Promise<CheckContactsResponse> {
    return this.userService.checkContacts(
      request.phoneNumbers,
      request.eventId,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserRequest,
  ): Promise<UpdateUserResponse> {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<DeleteUserResponse> {
    return this.userService.remove(id);
  }
}
