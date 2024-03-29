import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { DmService } from './services/dm/dm.service';
import { ChannelService } from './services/channel/channel.service';
import { MessageService } from './services/message/message.service';
import { ChatService } from './services/chat/chat.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { ChannelController } from './controllers/channel/channel.controller';
import NotificationService from 'src/notification/notification.service';
import { NotificationGateway } from 'src/notification/notification.gateway';
import { MessageController } from './controllers/message/message.controller';

@Module({
  imports: [],
  controllers: [ChannelController, MessageController],
  providers: [
    ChatService,
    ChatGateway,
    DmService,
    ChannelService,
    MessageService,
    JwtService,
    UsersService,
    NotificationService,
    NotificationGateway,
  ],
})
export class ChatModule {}
