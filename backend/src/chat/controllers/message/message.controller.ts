import { Controller, Get, HttpException, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards';
import { MessageService } from 'src/chat/services/message/message.service';

/* Here we have controllers to do the following through HTTP requests :

    1 - get Messages of a room based on the roomId
    2 - delete a message
    3 - edit a message
    4 - some other stuff ...
*/
// @UseGuards(new JwtAuthGuard())
@Controller('message')
export class MessageController {
    // constructor(private messageService: MessageService) 
    // {
    // }

    // @Get(':channelId')
    // async getMessages(@Req() req: Request) {
    //   try {
    //     return await this.messageService.getMessagesByChannelId(
    //       parseInt(req.params.channelId),
    //       req.user.id);
    //   } catch (error) {
    //     throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    //   }
    // }

    // @Post('delete/:messageId')
    // async deleteMessage(@Req() req: Request, payload : any) {
    //   try {
    //     return await this.messageService.deleteMessage(
    //       parseInt(req.params.messageId),
    //       req.user.id);
    //   }
    //   catch (error) {
    //     throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    //   }
    // }
      
}