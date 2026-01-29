import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ _id: false })
export class Vec2Document {
    @ApiProperty()
    @Prop({ required: true })
    x: number;

    @ApiProperty()
    @Prop({ required: true })
    y: number;
}

export const vec2Schema = SchemaFactory.createForClass(Vec2Document);
