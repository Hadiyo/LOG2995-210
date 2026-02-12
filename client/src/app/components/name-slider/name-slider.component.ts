import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';

@Component({
  selector: 'app-name-slider',
  templateUrl: './name-slider.component.html',
  styleUrls: ['./name-slider.component.scss'],
})
export class NameSliderComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) names: string[] = [];

  @Input() groupCount = 4;

  @ViewChild('track', { static: true }) private trackRef!: ElementRef<HTMLElement>;
  @ViewChild('group', { static: true }) private groupRef!: ElementRef<HTMLElement>;

  private resizeObserver?: ResizeObserver;

  get groups(): number[] {
    return Array.from({ length: this.groupCount }, (_, i) => i);
  }

  ngAfterViewInit(): void {
    this.updateShift();
    this.resizeObserver = new ResizeObserver(() => this.updateShift());
    this.resizeObserver.observe(this.groupRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  private updateShift(): void {
    const groupWidth = this.groupRef.nativeElement.scrollWidth;
    this.trackRef.nativeElement.style.setProperty('--ticker-shift', `${groupWidth}px`);
  }
}
