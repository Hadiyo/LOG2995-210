import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-pop-up',
  imports: [],
  templateUrl: './pop-up.component.html',
  styleUrl: './pop-up.component.scss',
})
export class PopUpComponent {
  /**  
   * Emit signal on close
   */
  @Output() closePopUp: EventEmitter<void> = new EventEmitter<void>();
  onClose() {
 this.closePopUp.emit(); 
}

  /**  
   * Emit signal on confirm
   */
  @Output() confirmPopUp: EventEmitter<void> = new EventEmitter<void>();
  onConfirm() {
 this.confirmPopUp.emit(); 
}
}
