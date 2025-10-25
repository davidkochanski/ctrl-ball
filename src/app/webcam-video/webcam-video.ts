import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';

@Component({
    selector: 'webcam-video',
    templateUrl: './webcam-video.html',
    styleUrls: ['./webcam-video.css']
})
export class WebcamComponent implements OnInit {
    @ViewChild('video', { static: true }) video!: ElementRef<HTMLVideoElement>;

    async ngOnInit() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.video.nativeElement.srcObject = stream;
        } catch (err) {
            console.error('Error accessing webcam:', err);
        }
    }
}
