import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonVariant } from '@app/shared/ui/button.types';

@Component({
  selector: 'app-button',
  imports: [RouterLink],
  templateUrl: './app-button.component.html',
  styleUrl: './app-button.component.scss',
})
export class AppButtonComponent {
  @Input({ required: true }) label!: string;
  @Input() link?: string;
  @Input() variant: ButtonVariant = ButtonVariant.Primary;

  protected readonly buttonVariant = ButtonVariant;
}
