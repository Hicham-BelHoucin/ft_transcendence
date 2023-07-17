import { Injectable } from '@nestjs/common';
import { ChannelType, MemberStatus, Message } from '@prisma/client';
import { MessageDto } from 'src/chat/dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class MessageService {
  constructor(
    private prisma: PrismaService,
    private chatService: ChatService,
  ) {}

  async makeMessage(data: MessageDto): Promise<Message | null> {
    try {
      const channelMember = await this.prisma.channelMember.findFirst({
        where: {
          userId: data.senderId,
          channelId: data.receiverId,
        },
      });
      if (channelMember && channelMember.status !== MemberStatus.ACTIVE)
        throw new Error('Cannot send message to this channel !');
      const ch = await this.prisma.channel.findUnique({
        where: {
          id: data.receiverId,
        },
        include: {
          channelMembers: true,
        },
      });

      if (
        ch.type === ChannelType.CONVERSATION &&
        (await this.chatService.isBlocked(
          ch.channelMembers.filter(
            (member) => member.userId != data.senderId,
          )[0].userId,
          data.senderId,
        ))
      ) {
        throw new Error('Cannot send message to this user !');
      }

      let message = await this.prisma.message.create({
        data: {
          content: data.content,
          senderId: data.senderId,
          receiverId: data.receiverId,
        },
      });
      if (!message) {
        return null;
      }
      message = await this.prisma.message.findUnique({
        where: {
          id: message.id,
        },
        include: {
          sender: true,
          receiver: true,
        },
      });

      ch.channelMembers.forEach(async (member) => {
        if (
          member.status !== MemberStatus.BANNED &&
          member.status !== MemberStatus.LEFT
        ) {
          await this.prisma.channel.update({
            where: {
              id: data.receiverId,
            },
            data: {
              newMessagesCount: {
                increment: 1,
              },
              deletedFor: {
                disconnect: {
                  id: member.userId,
                },
              },
              lastestMessageDate: message.date,
              updatedAt: message.date,
            },
          });
        }
      });
      return message;
    } catch (err) {
      throw new Error(err.message);
    }
  }

  async deleteMessage(userId, messageId) {
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        senderId: userId,
      },
    });

    if (!message) throw new Error('Cannot delete message !');
    await this.prisma.message.delete({
      where: {
        id: messageId,
      },
    });
    return { message: 'message deleted !' };
  }

  async pinMessage(messageId, pinnerId) {
    const message = await this.prisma.message.findUnique({
      where: {
        id: messageId,
      },
    });
    if (!message) throw new Error('Cannot pin message !');
    await this.prisma.message.update({
      where: {
        id: messageId,
      },
      data: {
        pinned: true,
        pinnerId,
      },
    });
    return { message: 'message pinned !' };
  }

  async UnpinMessage(messageId, pinnerId) {
    const message = await this.prisma.message.findUnique({
      where: {
        id: messageId,
      },
    });
    if (!message || message.pinnerId != pinnerId)
      throw new Error('Cannot pin message !');
    await this.prisma.message.update({
      where: {
        id: messageId,
      },
      data: {
        pinned: false,
        pinnerId,
      },
    });
    return { message: 'message pinned !' };
  }

  async updateMessage(messageId, data: MessageDto) {
    const message = await this.prisma.message.findUnique({
      where: {
        id: messageId,
      },
    });

    if (message.senderId != data.senderId)
      throw new Error('Cannot update message !');
    await this.prisma.message.update({
      where: {
        id: messageId,
      },
      data: data,
    });
  }

  async getMessagesByChannelIdOnly(channelId: number) {
    const messages = await this.prisma.message.findMany({
      where: {
        receiverId: channelId,
      },
      include: {
        sender: true,
        receiver: true,
      },
    });

    return messages;
  }

  async getMessagesByChannelId(
    channelId: number,
    userId: number,
  ): Promise<Message[]> {
    const channel = await this.prisma.channel.findUnique({
      where: {
        id: channelId,
      },
    });
    const channelmember = await this.prisma.channelMember.findFirst({
      where: {
        channelId,
        userId,
      },
    });
    if (
      !channelmember ||
      channelmember.status === MemberStatus.BANNED ||
      channelmember.status === MemberStatus.LEFT
    ) {
      const messages: Message[] = [];
      return messages;
    }

    const messages = await this.prisma.message.findMany({
      where: {
        receiverId: channelId,
      },
      include: {
        sender: true,
        receiver: true,
      },
    });
    const filteredMessages = [];
    for (const message of messages) {
      if (!(await this.chatService.isBlocked(userId, message.senderId))) {
        filteredMessages.push(message);
      }
    }
    return filteredMessages;
  }

  async getPinnedMessages(
    channelId: number,
    userId: number,
  ): Promise<Message[]> {
    const channelmember = await this.prisma.channelMember.findFirst({
      where: {
        channelId,
        userId,
      },
    });
    if (!channelmember || channelmember.status === MemberStatus.BANNED) {
      const messages: Message[] = [];
      return messages;
    }

    const messages = await this.prisma.message.findMany({
      where: {
        receiverId: channelId,
        pinned: true,
      },
      include: {
        sender: true,
        receiver: true,
      },
    });
    return messages;
  }
}
