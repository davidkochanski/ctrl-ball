import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { WebcamComponent } from "./webcam-video/webcam-video";

@Component({
  selector: 'app-root',
  imports: [WebcamComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('ctrl-ball');
}
