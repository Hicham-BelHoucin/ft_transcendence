import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { ChatService } from './services/chat/chat.service';
import { DmService } from './services/dm/dm.service';
import { ChannelService } from './services/channel/channel.service';
import { MessageService } from './services/message/message.service';
import { ChannelDto, DmDto, MessageDto } from './dto';
import { ChannelType, MemberStatus, Visiblity } from '@prisma/client';
import { UsersService } from 'src/users/users.service';
import { ArrayMultimap } from '@teppeis/multimaps';
import * as EVENT from './utils/';
import { randomInt } from 'crypto';
import NotificationService from 'src/notification/notification.service';
import { CommunDto } from './dto/member.dto';

@WebSocketGateway({ namespace: 'chat', cors: true, origins: '*' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private connectedClient: ArrayMultimap<number, Socket> = new ArrayMultimap();
  constructor(
    private chatService: ChatService,
    private dmService: DmService,
    private channelService: ChannelService,
    private messageService: MessageService,
    private jwtService: JwtService,
    private userService: UsersService,
    private notificationService: NotificationService,
  ) {}

  /* -------------------------------------- Handle Server Connection -------------------------------------*/

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      await this.verifyClient(client);
      this.connectedClient.put(client.data.sub, client);
      await this.joinChannels(client);
      await this.sendChannelsToClient(client);
      if (client.data.sub)
        await this.userService.updateStatus('ONLINE', client.data.sub);
    } catch (error) {
      this.disconnect(client, error);
      new WsException({
        error: 'connection',
        message: error.message,
      });
    }
  }

  async handleDisconnect(client: Socket) {
    if (client.data.sub) {
      await this.userService.updateStatus('OFFLINE', client.data.sub);
      this.connectedClient.delete(client.data.sub);
    }
  }

  async disconnect(client: Socket, error?) {
    client.emit(error, new UnauthorizedException());
    client.disconnect();
  }

  /* -------------------------------------- WEBSOCKET EVENTS HANDLERS -------------------------------------*/

  @SubscribeMessage(EVENT.MESSAGE)
  async sendMessage(client: Socket, payload: any) {
    try {
      const dto: MessageDto = {
        senderId: payload.senderId,
        receiverId: payload.receiverId,
        content: payload.content,
      };
      const message = await this.messageService.makeMessage(dto);
      if (!message) {
        throw new WsException({
          error: EVENT.ERROR,
          message: 'Cannot send message',
        });
      }
      await this.sendChannelsToChannelMembers(dto.receiverId);
      await this.sendMessageToChannelMembers(
        dto.senderId,
        dto.receiverId,
        message,
      );
    } catch (error) {
      client.emit(EVENT.ERROR, error.message);
    }
  }

  @SubscribeMessage(EVENT.DM_CREATE)
  async createDm(client: Socket, payload: DmDto) {
    try {
      //create a dm send channels to user
      const dm = await this.dmService.makeDm(payload);
      if (!dm) {
        throw new WsException({
          error: EVENT.ERROR,
          message: 'Cannot create dm',
        });
      }
      const channelTosend = await this.channelService.getChannelById(dm.id);
      const sockets = this.getConnectedUsers(client.data.sub);
      await this.sendChannelsToChannelMembers(dm.id);
      await this.sendMessagesToMembers(dm.id);
      if (!sockets || sockets.length === 0) return;
      sockets.forEach((s) => {
        s.join(dm.id.toString());
        this.server.to(s.id).emit(EVENT.DM_CREATE, channelTosend);
      });
    } catch (err) {
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.KICK_USER)
  async kickUser(client: Socket, payload: CommunDto) {
    try {
      await this.channelService.kickUser(
        client.data.sub,
        parseInt(payload.userId),
        parseInt(payload.channelId),
      );
      await this.updateCurrentChannel(parseInt(payload.channelId), client);
      await this.sendNotificationToUser(
        client.data.sub,
        parseInt(payload.channelId),
        ' has kicked you from the channel ',
        parseInt(payload.userId),
      );
    } catch (err) {
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.GET_CH_MEMBER)
  async getChannelMember(client: Socket, payload: CommunDto) {
    try {
      const members =
        await this.channelService.getChannelMemberByUserIdAndChannelId(
          parseInt(payload.userId),
          parseInt(payload.channelId),
        );
      client.emit(EVENT.GET_CH_MEMBER, members);
    } catch (err) {
      throw new WsException({
        error: EVENT.GET_CH_MEMBER,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.CHANNEL_JOIN)
  async joinChannel(client: Socket, payload: CommunDto) {
    try {
      let ch;
      const channel = await this.channelService.getChannelById(
        parseInt(payload.channelId),
      );
      if (!channel || channel.type === ChannelType.CONVERSATION) {
        throw new WsException({
          error: EVENT.ERROR,
          message: 'Channel does not exist',
        });
      }
      if (channel.visiblity === Visiblity.PROTECTED)
        ch = await this.channelService.JoinChannel(
          client.data.sub,
          parseInt(payload.channelId),
          payload.password,
        );
      else
        ch = await this.channelService.JoinChannel(
          client.data.sub,
          parseInt(payload.channelId),
        );
      if (!ch) {
        throw new WsException({
          error: EVENT.ERROR,
          message: 'Cannot join channel',
        });
      }
      await this.sendNotifications(
        client.data.sub,
        channel.id,
        ' has joined the channel',
      );
      const sockets = this.getConnectedUsers(client.data.sub);
      if (!sockets || sockets.length === 0) return;
      sockets.forEach((s) => {
        s.join(parseInt(payload.channelId).toString());
        this.server.to(s.id).emit(EVENT.CHANNEL_JOIN, channel);
      });
      await this.updateCurrentChannel(parseInt(payload.channelId), client);
    } catch (err) {
      client.emit(EVENT.ERROR, err.message);
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.RESET_MSSG_COUNT)
  async resetMssgCount(client: Socket, payload: CommunDto) {
    try {
      await this.messageService.resetMessageCount(
        client.data.sub,
        parseInt(payload.channelId),
      );
      await this.sendChannelsToChannelMembers(parseInt(payload.channelId));
      // await this.updateCurrentChannel(parseInt(payload.channelId), client);
    } catch (err) {
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.CHANNEL_CREATE)
  async createChannel(client: Socket, payload: ChannelDto) {
    try {
      const channel = await this.channelService.makeChannel(
        client.data.sub,
        payload,
      );
      if (!channel) {
        throw new WsException({
          error: EVENT.CHANNEL_CREATE,
          message: 'Cannot create channel',
        });
      }
      const channelTosend = await this.channelService.getChannelById(
        channel.id,
      );
      await this.sendNotifications(
        client.data.sub,
        channel.id,
        ' has added you to the channel ',
      );
      const sockets = this.getConnectedUsers(client.data.sub);
      sockets.forEach((s) => {
        s.join(channel.id.toString());
        this.server.to(s.id).emit(EVENT.CHANNEL_CREATE, channelTosend);
      });
      await this.sendChannelsToChannelMembers(channel.id);
      await this.sendMessagesToMembers(channel.id);
    } catch (error) {
      client.emit(EVENT.ERROR, error.message);
      throw new WsException({
        error: EVENT.ERROR,
        message: error.message,
      });
    }
  }

  @SubscribeMessage(EVENT.CHANNEL_UPDATE)
  async updateChannel(client: Socket, payload: ChannelDto) {
    // this.validatePayload(payload);
    try {
      const channel = await this.channelService.updateChannel(
        client.data.sub,
        payload,
      );
      await this.updateCurrentChannel(payload.id, client);
      await this.sendNotifications(
        client.data.sub,
        channel.id,
        ' has updated the channel ' + payload.type,
      );
      if (payload.type === 'members') {
        payload.members.forEach((member) => {
          this.sendNotificationToUser(
            client.data.sub,
            channel.id,
            ' has added you to the channel ',
            member,
          );
        });
      }
    } catch (error) {
      client.emit(EVENT.ERROR, error.message);
      throw new WsException({
        error: EVENT.ERROR,
        message: error.message,
      });
    }
  }

  @SubscribeMessage(EVENT.GET_CHANNELS)
  async getChannels(client: Socket): Promise<void> {
    try {
      const channels = await this.channelService.getChannelsByUserId(
        client.data.sub,
      );
      client.emit(EVENT.GET_CHANNELS, channels);
    } catch (err) {
      throw new WsException({
        error: EVENT.GET_CHANNELS,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.GET_ARCHIVED_CHANNELS)
  async getArchivedChannels(client: Socket): Promise<void> {
    try {
      const channels = await this.channelService.getArchivedChannelsByUserId(
        client.data.sub,
      );
      client.emit(EVENT.GET_ARCHIVED_CHANNELS, channels);
    } catch (err) {
      throw new WsException({
        error: EVENT.GET_ARCHIVED_CHANNELS,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.GET_CH_MEMBERS)
  async ChannelMembers(client: Socket, channelId: string) {
    try {
      const members = await this.channelService.getChannelMembersByChannelId(
        parseInt(channelId),
      );

      client.emit(EVENT.GET_CH_MEMBERS, members);
    } catch (err) {
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.CHANNEL_ACCESS)
  async ChannelAccess(client: Socket, payload: CommunDto) {
    try {
      const channelMember =
        await this.channelService.getChannelMemberByUserIdAndChannelId(
          client.data.sub,
          parseInt(payload.channelId),
        );
      if (!channelMember) {
        client.emit(EVENT.ERROR, 'You are not a member of this channel !');
      }
      const channel = await this.channelService.getChannelById(
        parseInt(payload.channelId),
      );
      client.emit(EVENT.CHANNEL_ACCESS, channel);
    } catch (err) {
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.CHANNEL_LEAVE)
  async leaveChannel(client: Socket, payload: CommunDto) {
    try {
      await this.channelService.leaveChannel(
        client.data.sub,
        parseInt(payload.channelId),
      );
      await this.updateCurrentChannel(parseInt(payload.channelId), client);
      await this.sendChannelsToClient(client);
      await this.sendNotifications(
        client.data.sub,
        parseInt(payload.channelId),
        ' has left the channel ',
      );
      const sockets = this.getConnectedUsers(client.data.sub);
      sockets.forEach((s) => {
        s.leave(payload.channelId);
        this.server
          .to(s.id)
          .emit(EVENT.CHANNEL_LEAVE, parseInt(payload.channelId));
      });
    } catch (err) {
      client.emit(EVENT.ERROR, err.message);
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.SET_ADMIN)
  async setAdmin(client: Socket, payload: CommunDto) {
    try {
      await this.channelService.setAsAdmin(
        parseInt(client.data.sub),
        parseInt(payload.userId),
        parseInt(payload.channelId),
      );

      await this.updateCurrentChannel(parseInt(payload.channelId), client);
      await this.sendNotificationToUser(
        client.data.sub,
        parseInt(payload.channelId),
        ' has changed your role in the channel ',
        parseInt(payload.userId),
      );
    } catch (err) {
      client.emit(EVENT.ERROR, err.message);
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.SET_OWNER)
  async setOwner(client: Socket, payload: CommunDto) {
    try {
      await this.channelService.setAsOwner(
        parseInt(client.data.sub),
        parseInt(payload.userId),
        parseInt(payload.channelId),
      );

      await this.updateCurrentChannel(parseInt(payload.channelId), client);
      await this.sendNotificationToUser(
        client.data.sub,
        parseInt(payload.channelId),
        ' has changed your role in the channel ',
        parseInt(payload.userId),
      );
    } catch (err) {
      client.emit(EVENT.ERROR, err.message);
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.BLOCK_USER)
  async blockUser(
    client: Socket,
    payload: { blockerId: string; blockedId: string; isBlock: boolean },
  ) {
    try {
      const blocker = await this.userService.findUserById(
        parseInt(payload.blockerId),
      );
      const blocked = await this.userService.findUserById(
        parseInt(payload.blockedId),
      );

      const data = {
        id: randomInt(1, 9999999),
        title: blocker.username,
        content:
          blocker.username +
          (payload.isBlock === true
            ? ' has blocked you !'
            : ' has unblocked you !'),

        createdAt: new Date(),
        updatedAt: new Date(),
        seen: false,
        sender: blocker,
        receiver: blocked,
        url: `/profile/${payload.blockedId}`,
      };
      this.notificationService.createNotification(
        parseInt(payload.blockerId),
        parseInt(payload.blockedId),
        data.title,
        data.content,
        data.url,
      );
      const sockets: Socket[] = this.getConnectedUsers(
        parseInt(payload.blockedId),
      );
      for (const socket of sockets) {
        this.server.to(socket.id).emit(EVENT.NOTIFICATION, data);
        this.server.to(socket.id).emit(EVENT.BLOCK_USER);
      }
      const sockets2: Socket[] = this.getConnectedUsers(
        parseInt(payload.blockerId),
      );
      for (const socket of sockets2) {
        this.server.to(socket.id).emit(EVENT.BLOCK_USER);
      }
    } catch (err) {
      throw new WsException({
        error: EVENT.BLOCK_USER,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.UNSET_ADMIN)
  async unsetAdmin(client: Socket, payload: CommunDto) {
    try {
      await this.channelService.setAsAdmin(
        1,
        parseInt(payload.userId),
        parseInt(payload.channelId),
      );
      await this.updateCurrentChannel(parseInt(payload.channelId), client);
    } catch (err) {
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.BAN_FROM_CHANNEL)
  async banFromChannel(client: Socket, payload: CommunDto) {
    try {
      await this.channelService.banUser(
        parseInt(client.data.sub),
        parseInt(payload.userId),
        parseInt(payload.channelId),
      );
      await this.updateCurrentChannel(parseInt(payload.channelId), client);
      await this.sendNotificationToUser(
        client.data.sub,
        parseInt(payload.channelId),
        ' has banned you from the channel ',
        parseInt(payload.userId),
      );
    } catch (err) {
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.UNBAN_FROM_CHANNEL)
  async UnbanFromChannel(client: Socket, payload: CommunDto) {
    try {
      await this.channelService.unbanUser(
        parseInt(client.data.sub),
        parseInt(payload.userId),
        parseInt(payload.channelId),
      );
      await this.updateCurrentChannel(parseInt(payload.channelId), client);
      await this.sendNotificationToUser(
        client.data.sub,
        parseInt(payload.channelId),
        ' has unbanned you from the channel ',
        parseInt(payload.userId),
      );
    } catch (err) {
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.CHECK_ACCESS_PASS)
  async checkAccessPass(client: Socket, payload: CommunDto) {
    try {
      console.log(payload);
      const ru = await this.channelService.checkAccessPass(
        parseInt(payload.channelId),
        payload.password,
      );
      console.log(ru);
      await this.updateCurrentChannel(parseInt(payload.channelId), client);
      if (!ru) client.emit(EVENT.ERROR, 'Wrong access password !');
      client.emit(EVENT.CHECK_ACCESS_PASS, ru);
    } catch (err) {
      console.log(err);
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.GET_CLIENT_MSSGS)
  async getClientMessages(client: Socket, payload: CommunDto) {
    try {
      const channelMembers =
        await this.channelService.getChannelMembersByChannelId(
          parseInt(payload.channelId),
        );
      for (const member of channelMembers) {
        const messages = await this.messageService.getMessagesByChannelId(
          parseInt(payload.channelId),
          member.userId,
        );
        const sockets = this.getConnectedUsers(member.userId);
        sockets.forEach((s) => {
          this.server.to(s.id).emit(EVENT.GET_CLIENT_MSSGS, messages);
        });
      }
    } catch (err) {
      throw new WsException({
        error: EVENT.GET_CLIENT_MSSGS,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.GET_CH_MSSGS)
  async ChannelMessages(client: Socket, payload: CommunDto) {
    try {
      const messages = await this.messageService.getMessagesByChannelId(
        parseInt(payload.channelId),
        parseInt(payload.userId),
      );
      const members = await this.channelService.getChannelMembersByChannelId(
        parseInt(payload.channelId),
      );
      members.forEach((member) => {
        const sockets = this.getConnectedUsers(member.userId);
        sockets.forEach((s) => {
          this.server.to(s.id).emit(EVENT.GET_CH_MSSGS, messages);
        });
      });
    } catch (err) {
      throw new WsException({
        error: EVENT.GET_CH_MSSGS,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.GET_DM_MSSGS)
  async DmMessages(client: Socket, dmId: string) {
    try {
      await this.messageService.getMessagesByChannelId(
        parseInt(dmId),
        client.data.sub,
      );
    } catch (err) {
      throw new WsException({
        error: EVENT.GET_DM_MSSGS,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.CHANNEL_DELETE)
  async deleteChannel(client: Socket, payload: CommunDto) {
    try {
      await this.channelService.deleteChannel(
        parseInt(payload.channelId),
        client.data.sub,
      );
      const sockets = this.getConnectedUsers(client.data.sub);
      const channels = await this.channelService.getChannelsByUserId(
        client.data.sub,
      );
      sockets.forEach((s) => {
        s.leave(payload.channelId);
        this.server.to(s.id).emit(EVENT.CHANNEL_DELETE, channels);
      });
      this.sendChannels(client.data.sub);
    } catch (err) {
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.CHANNEL_REMOVE)
  async removeChannel(client: Socket, payload: CommunDto) {
    try {
      const channel = await this.channelService.getChannelById(
        parseInt(payload.channelId),
      );
      const channelMembers =
        await this.channelService.getChannelMembersByChannelId(
          parseInt(payload.channelId),
        );
      if (!channel) throw new Error('Channel not found !');
      await this.sendNotifications(
        client.data.sub,
        parseInt(payload.channelId),
        ' has deleted the channel',
      );
      await this.channelService.removeChannel(
        client.data.sub,
        parseInt(payload.channelId),
      );
      channelMembers
        .filter(
          (member) =>
            member.status !== MemberStatus.BANNED &&
            member.status !== MemberStatus.LEFT,
        )
        .forEach((member) => {
          this.sendChannels(member.userId);
          const sockets = this.getConnectedUsers(member.userId);
          sockets.forEach((socket) =>
            this.server
              .to(socket.id)
              .emit(EVENT.CHANNEL_REMOVE, { id: parseInt(payload.channelId) }),
          );
        });
    } catch (err) {
      client.emit(EVENT.ERROR, err.message);
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.PIN_CHANNEL)
  async pinChannel(client: Socket, payload: CommunDto) {
    // to do userId could be get from backend directly ...
    try {
      const chMember = await this.channelService.pinChannel(
        parseInt(client.data.sub),
        parseInt(payload.channelId),
      );
      const channels = await this.channelService.getChannelsByUserId(
        client.data.sub,
      );
      const archived = await this.channelService.getArchivedChannelsByUserId(
        client.data.sub,
      );
      const sockets = this.getConnectedUsers(client.data.sub);
      sockets.forEach((s) => {
        this.server.to(s.id).emit(EVENT.GET_CH_MEMBER, chMember);
        this.server.to(s.id).emit(EVENT.GET_CHANNELS, channels);
        this.server.to(s.id).emit(EVENT.GET_ARCHIVED_CHANNELS, archived);
      });
    } catch (err) {
      throw new WsException({
        error: EVENT.PIN_CHANNEL,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.UNPIN_CHANNEL)
  async unpinChannel(client: Socket, payload: CommunDto) {
    try {
      await this.channelService.unpinChannel(
        parseInt(client.data.sub),
        parseInt(payload.channelId),
      );
      const channels = await this.channelService.getChannelsByUserId(
        client.data.sub,
      );
      const archived = await this.channelService.getArchivedChannelsByUserId(
        client.data.sub,
      );
      const sockets = this.getConnectedUsers(client.data.sub);
      sockets.forEach((s) => {
        this.server.to(s.id).emit(EVENT.GET_CHANNELS, channels);
        this.server.to(s.id).emit(EVENT.GET_ARCHIVED_CHANNELS, archived);
      });
    } catch (err) {
      throw new WsException({
        error: EVENT.UNPIN_CHANNEL,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.MUTE_CHANNEL)
  async muteChannel(client: Socket, payload: CommunDto) {
    try {
      await this.channelService.muteChannel(
        parseInt(client.data.sub),
        parseInt(payload.channelId),
      );
      const channels = await this.channelService.getChannelsByUserId(
        client.data.sub,
      );
      const archived = await this.channelService.getArchivedChannelsByUserId(
        client.data.sub,
      );
      const sockets = this.getConnectedUsers(client.data.sub);
      sockets.forEach((s) => {
        this.server.to(s.id).emit(EVENT.GET_CHANNELS, channels);
        this.server.to(s.id).emit(EVENT.GET_ARCHIVED_CHANNELS, archived);
      });
    } catch (err) {
      throw new WsException({
        error: EVENT.MUTE_CHANNEL,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.UNMUTE_CHANNEL)
  async unmuteChannel(client: Socket, payload: CommunDto) {
    try {
      await this.channelService.unmuteChannel(
        parseInt(client.data.sub),
        parseInt(payload.channelId),
      );
      const channels = await this.channelService.getChannelsByUserId(
        client.data.sub,
      );
      const archived = await this.channelService.getArchivedChannelsByUserId(
        client.data.sub,
      );
      const sockets = this.getConnectedUsers(client.data.sub);
      sockets.forEach((s) => {
        this.server.to(s.id).emit(EVENT.GET_CHANNELS, channels);
        this.server.to(s.id).emit(EVENT.GET_ARCHIVED_CHANNELS, archived);
      });
    } catch (err) {
      throw new WsException({
        error: EVENT.UNMUTE_CHANNEL,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.ARCHIVE_CHANNEL)
  async archiveChannel(client: Socket, payload: CommunDto) {
    try {
      await this.channelService.archiveChannel(
        parseInt(client.data.sub),
        parseInt(payload.channelId),
      );
      const channels = await this.channelService.getChannelsByUserId(
        client.data.sub,
      );
      const archived = await this.channelService.getArchivedChannelsByUserId(
        client.data.sub,
      );
      const sockets = this.getConnectedUsers(client.data.sub);
      sockets.forEach((s) => {
        this.server.to(s.id).emit(EVENT.GET_CHANNELS, channels);
        this.server.to(s.id).emit(EVENT.GET_ARCHIVED_CHANNELS, archived);
      });
    } catch (err) {
      throw new WsException({
        error: EVENT.ARCHIVE_CHANNEL,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.UNARCHIVE_CHANNEL)
  async unarchiveChannel(client: Socket, payload: CommunDto) {
    try {
      await this.channelService.unarchiveChannel(
        parseInt(client.data.sub),
        parseInt(payload.channelId),
      );
      const channels = await this.channelService.getChannelsByUserId(
        client.data.sub,
      );
      const archived = await this.channelService.getArchivedChannelsByUserId(
        client.data.sub,
      );
      const sockets = this.getConnectedUsers(client.data.sub);
      sockets.forEach((s) => {
        this.server.to(s.id).emit(EVENT.GET_CHANNELS, channels);
        this.server.to(s.id).emit(EVENT.GET_ARCHIVED_CHANNELS, archived);
      });
    } catch (err) {
      throw new WsException({
        error: EVENT.ARCHIVE_CHANNEL,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.MUTE_USER)
  async muteUser(client: Socket, payload: CommunDto) {
    try {
      await this.channelService.muteUser(
        parseInt(client.data.sub),
        parseInt(payload.userId),
        parseInt(payload.channelId),
        parseInt(payload.banDuration),
      );
      await this.updateCurrentChannel(parseInt(payload.channelId), client);
      await this.sendNotificationToUser(
        client.data.sub,
        parseInt(payload.channelId),
        ' has muted you in the channel ',
        parseInt(payload.userId),
      );
    } catch (err) {
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.UNMUTE_USER)
  async unmuteUser(client: Socket, payload: CommunDto) {
    try {
      await this.sendNotificationToUser(
        client.data.sub,
        parseInt(payload.channelId),
        ' has unmuted you in the channel ',
        parseInt(payload.userId),
      );
      await this.channelService.unmuteUser(
        parseInt(client.data.sub),
        parseInt(payload.userId),
        parseInt(payload.channelId),
      );
      await this.updateCurrentChannel(parseInt(payload.channelId), client);
    } catch (err) {
      throw new WsException({
        error: EVENT.MUTE_USER,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.CHECK_MUTE)
  async checkMute(client: Socket, payload: CommunDto) {
    try {
      const isMuted = await this.channelService.checkMute(
        parseInt(payload.userId),
        parseInt(payload.channelId),
      );
      if (!isMuted)
        await this.updateCurrentChannel(parseInt(payload.channelId), client);

      const sockets = this.getConnectedUsers(client.data.sub);
      sockets.forEach((socket) => {
        // this.server.to(socket.id).emit('refresh_member');
        this.server.to(socket.id).emit(EVENT.CHECK_MUTE, isMuted);
      });
    } catch (err) {
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.MESSAGE_DELETE)
  async deleteMessage(client: Socket, payload: any) {
    try {
      await this.messageService.deleteMessage(
        parseInt(client.data.sub),
        parseInt(payload.messageId),
      );
      await this.updateCurrentChannel(parseInt(payload.channelId), client);
      await this.sendMessagesToMembers(parseInt(payload.channelId));
    } catch (err) {
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.MARK_UNREAD)
  async markUnread(client: Socket, payload: any) {
    try {
      await this.channelService.markUnread(
        parseInt(client.data.sub),
        parseInt(payload.channelId),
      );
      const channels = await this.channelService.getChannelsByUserId(
        client.data.sub,
      );
      const archived = await this.channelService.getArchivedChannelsByUserId(
        client.data.sub,
      );
      const sockets = this.getConnectedUsers(client.data.sub);
      sockets.forEach((s) => {
        this.server.to(s.id).emit(EVENT.GET_CHANNELS, channels);
        this.server.to(s.id).emit(EVENT.GET_ARCHIVED_CHANNELS, archived);
      });
    } catch (err) {
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.MARK_READ)
  async markRead(client: Socket, payload: CommunDto) {
    try {
      await this.channelService.markRead(
        parseInt(client.data.sub),
        parseInt(payload.channelId),
      );
      const channels = await this.channelService.getChannelsByUserId(
        client.data.sub,
      );
      const archived = await this.channelService.getArchivedChannelsByUserId(
        client.data.sub,
      );
      const sockets = this.getConnectedUsers(client.data.sub);
      sockets.forEach((s) => {
        this.server.to(s.id).emit(EVENT.GET_CHANNELS, channels);
        this.server.to(s.id).emit(EVENT.GET_ARCHIVED_CHANNELS, archived);
      });
    } catch (err) {
      throw new WsException({
        error: EVENT.MARK_UNREAD,
        message: err.message,
      });
    }
  }

  @SubscribeMessage(EVENT.REFRESH_CHANNEL)
  async refrechChannel(client: Socket, payload: CommunDto) {
    try {
      const channel = await this.channelService.getChannelById(
        parseInt(payload.channelId),
      );
      if (!channel) throw new Error('Channel not found !');
      this.updateCurrentChannel(parseInt(payload.channelId), client);
    } catch (err) {
      throw new WsException({
        error: EVENT.ERROR,
        message: err.message,
      });
    }
  }

  /* -------------------------------------- Helper functions -------------------------------------*/

  async joinRoom(client: Socket, payload: CommunDto) {
    try {
      const ru = await this.channelService.JoinChannel(
        client.data.sub,
        parseInt(payload.channelId),
        payload.password,
      );
      const sockets = this.getConnectedUsers(client.data.sub);
      sockets.forEach((s) => {
        s.join(payload.channelId);
        this.server.to(s.id).emit(EVENT.CHANNEL_JOIN, ru);
      });
      this.sendChannels(client.data.sub);
    } catch (err) {
      throw new WsException({
        error: EVENT.CHANNEL_JOIN,
        message: err.message,
      });
    }
  }

  private async verifyClient(client) {
    let token: string = client.handshake.auth.token as string;
    if (token.search('Bearer') !== -1) token = token.split(' ')[1];
    try {
      const data = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      client.data = data;
      return data;
    } catch (err) {
      throw new WsException({
        error: 'Authentication failed',
        message: err.message,
      });
    }
  }

  private async joinChannels(client: Socket) {
    const channels = await this.channelService.getChannelsByUserId(
      client.data.sub,
    );
    channels.forEach((channel) => {
      client.join(channel.id.toString());
    });
  }
  private async sendChannelsToClient(client: Socket) {
    const channels = await this.channelService.getChannelsByUserId(
      client.data.sub,
    );
    client.emit(EVENT.GET_CHANNELS, channels);
  }

  private async sendChannelsToChannelMembers(channelId: number) {
    const members = await this.channelService.getChannelMembersByChannelId(
      channelId,
    );
    members.forEach(async (member) => {
      if (member.status === MemberStatus.ACTIVE) {
        const sockets = await this.getConnectedUsers(member.userId);
        const channels = await this.channelService.getChannelsByUserId(
          member.userId,
        );
        const archived = await this.channelService.getArchivedChannelsByUserId(
          member.userId,
        );
        sockets.forEach((socket) => {
          this.server.to(socket.id).emit(EVENT.GET_CHANNELS, channels);
          this.server.to(socket.id).emit(EVENT.GET_ARCHIVED_CHANNELS, archived);
        });
      }
    });
  }

  private async sendMessageToChannelMembers(
    senderId: number,
    channelId: number,
    message: MessageDto,
  ) {
    const members = await this.channelService.getChannelMembersByChannelId(
      channelId,
    );
    const channel = await this.channelService.getChannelById(channelId);
    let sockets;
    members.forEach(async (member) => {
      const messages = await this.messageService.getMessagesByChannelId(
        channelId,
        member.userId,
      );
      if (
        member.status !== MemberStatus.ACTIVE ||
        (await this.chatService.isBlocked(senderId, member.userId))
      )
        return;
      sockets = this.getConnectedUsers(member.userId);
      sockets.forEach((socket) => {
        this.server.to(socket.id).emit('message', message);
        // const data = {
        //   id: randomInt(1000000, 9999999),
        //   title: 'New message',
        //   content: message.content,
        //   createdAt: message.date,
        //   updatedAt: message.date,
        //   seen: false,
        //   sender: message.sender,
        //   receiver: member.userId,
        //   url: '/chat',
        // };
        this.server.to(socket.id).emit(EVENT.GET_CH_MSSGS, messages);
      });
    });
  }

  private getConnectedUsers(id: number): Socket[] {
    const connectedUsers: Socket[] = [];
    this.connectedClient.forEach((user) => {
      if (user.data.sub === id) connectedUsers.push(user);
    });
    return connectedUsers;
  }

  private async sendChannels(userId: number) {
    try {
      const channels = await this.channelService.getChannelsByUserId(userId);
      const sockets = this.getConnectedUsers(userId);
      for (const socket of sockets) {
        this.server.to(socket.id).emit(EVENT.GET_CHANNELS, channels);
      }
    } catch (error) {
      throw new Error(error);
    }
  }

  private async sendNotifications(
    userId: number,
    channelId: number,
    event: string,
    user2Id?: number,
  ) {
    try {
      const channel = await this.channelService.getChannelById(channelId);
      let data;
      const channelMembers =
        await this.channelService.getChannelMembersByChannelId(channelId);
      const user = await this.userService.findUserById(userId);
      if (user2Id) {
        if (await this.chatService.isBlocked(userId, user2Id)) return;
        const user2 = await this.userService.findUserById(user2Id);
        data = {
          id: randomInt(1, 9999999),
          title: channel.name,
          content: user.username + event + user2?.username,
          createdAt: new Date(),
          updatedAt: new Date(),
          seen: false,
          sender: user,
          receiver: userId,
          url: '/chat',
        };
      } else {
        data = {
          id: randomInt(1, 9999999),
          title: channel.name,
          content: user.username + event,
          createdAt: new Date(),
          updatedAt: new Date(),
          seen: false,
          sender: user,
          receiver: userId,
          url: '/chat',
        };
      }
      channelMembers
        .filter(
          (member) =>
            member.status !== MemberStatus.BANNED &&
            member.status !== MemberStatus.LEFT,
        )
        .forEach(async (member) => {
          if (
            !channel.mutedFor.map((u) => u.id).includes(member.userId) &&
            !(await this.chatService.isBlocked(userId, member.userId))
          ) {
            this.notificationService.createNotification(
              userId,
              member.userId,
              data.title,
              data.content,
              data.url,
            );
            const sockets: Socket[] = this.getConnectedUsers(member.userId);
            for (const socket of sockets) {
              this.server.to(socket.id).emit(EVENT.NOTIFICATION, data);
            }
          }
        });
    } catch (err) {
      throw new Error(err);
    }
  }

  private async sendNotificationToUser(
    userId: number,
    channelId,
    event: string,
    user2Id?: number,
  ) {
    const user = await this.userService.findUserById(userId);
    const channel = await this.channelService.getChannelById(channelId);
    if (channel.mutedFor.map((u) => u.id).includes(user2Id)) return;
    if (await this.chatService.isBlocked(userId, user2Id)) return;
    const data = {
      id: randomInt(1, 9999999),
      title: channel.name,
      content: user.username + event,
      createdAt: new Date(),
      updatedAt: new Date(),
      seen: false,
      sender: user,
      receiver: userId,
      url: '/chat',
    };
    this.notificationService.createNotification(
      userId,
      user2Id,
      data.title,
      data.content,
      data.url,
    );
    const sockets: Socket[] = this.getConnectedUsers(user2Id);
    for (const socket of sockets) {
      this.server.to(socket.id).emit(EVENT.NOTIFICATION, data);
    }
  }

  private async sendMessagesToMembers(channelId: number) {
    try {
      const members = await this.channelService.getChannelMembersByChannelId(
        channelId,
      );
      members.forEach(async (member) => {
        const messages = await this.messageService.getMessagesByChannelId(
          channelId,
          member.userId,
        );
        const sockets: Socket[] = this.getConnectedUsers(member.userId);
        for (const socket of sockets) {
          this.server.to(socket.id).emit(EVENT.GET_CH_MSSGS, messages);
        }
      });
    } catch (err) {
      throw new Error(err);
    }
  }

  private async updateCurrentChannel(channelId: number, client?: Socket) {
    try {
      const channel = await this.channelService.getChannelById(channelId);
      const channelMembers =
        await this.channelService.getChannelMembersByChannelId(channelId);
      channelMembers
        .filter(
          (member) =>
            member.status !== MemberStatus.BANNED &&
            member.status !== MemberStatus.LEFT,
        )
        .forEach((member) => {
          this.sendChannels(member.userId);
          const sockets: Socket[] = this.getConnectedUsers(member.userId);
          for (const socket of sockets) {
            this.server.to(socket.id).emit(EVENT.CURRENT_CH_UPDATE, channel);
          }
        });
      const sockets: Socket[] = this.getConnectedUsers(client.data.sub);
      for (const socket of sockets) {
        this.server.to(socket.id).emit(EVENT.CURRENT_CH_UPDATE, channel);
      }
    } catch (err) {
      throw new Error(err);
    }
  }
}
