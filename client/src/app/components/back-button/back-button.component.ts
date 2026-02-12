import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-back-button',
  standalone: true,
  templateUrl: './back-button.component.html',
  styleUrl: './back-button.component.scss',
})
export class BackButtonComponent {
  @Input() link?: string;
  @Input() ariaLabel = 'Retour à la page précédente';
  @Input() title = 'Retour';
  @Input() disabled = false;

  @Output() pressed = new EventEmitter<void>();

  /// Indicates if the button should navigate using a link or emit an event when pressed.
  get isLinkMode(): boolean {
    return !!this.link;
  }

  // Router is needed to navigate when the button is in link mode
  constructor(private readonly router: Router) { }

  // Handles the button press action, 
  // either by navigating to a link or emitting an event.
  onPress(): void {
    if (this.disabled) return;
    // If a link is provided, navigate to it.
    if (this.link) {
      void this.router.navigateByUrl(this.link);
      return;
    }
    // Otherwise, emit the pressed event.
    this.pressed.emit();
  }
}
