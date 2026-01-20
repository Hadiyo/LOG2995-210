import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './app-button.component.html',
  styleUrl: './app-button.component.scss',
})
export class AppButtonComponent {
  @Input({ required: true }) label!: string;
  @Input() link?: string;
  @Input() disabled = false;
  @Input() variant: 'primary' | 'secondary' | 'ghost' = 'primary';
}
