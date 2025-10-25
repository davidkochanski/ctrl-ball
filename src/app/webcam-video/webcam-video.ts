import { Component, ElementRef, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

@Component({
    selector: 'webcam-video',
    templateUrl: './webcam-video.html',
    styleUrls: ['./webcam-video.css']
})
export class WebcamComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('video', { static: true }) video!: ElementRef<HTMLVideoElement>;
    @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

    private detector!: poseDetection.PoseDetector;
    private animationFrameId!: number;

    async ngOnInit() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.video.nativeElement.srcObject = stream;
        } catch (err) {
            console.error('Error accessing webcam:', err);
        }
    }

    async ngAfterViewInit() {
        await tf.setBackend('webgl');
        await tf.ready();

        this.detector = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
        );

        this.detectPose();
    }

    async detectPose() {
        const ctx = this.canvas.nativeElement.getContext('2d')!;
        const video = this.video.nativeElement;

        const drawLoop = async () => {
            const poses = await this.detector.estimatePoses(video);

            // Match canvas size to video
            this.canvas.nativeElement.width = video.videoWidth;
            this.canvas.nativeElement.height = video.videoHeight;

            ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
            ctx.save();
            ctx.translate(-this.canvas.nativeElement.width, 0);
            ctx.drawImage(video, 0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
            ctx.restore();

            if (poses.length > 0) {
                const keypoints = poses[0].keypoints;
                this.drawKeypoints(ctx, keypoints);
                this.drawSkeleton(ctx, keypoints);
            }

            this.animationFrameId = requestAnimationFrame(drawLoop);
        };

        drawLoop();
    }

    drawKeypoints(ctx: CanvasRenderingContext2D, keypoints: any[]) {
        keypoints.forEach(kp => {
            if (kp.score > 0.4) {
                ctx.beginPath();
                ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = 'red';
                ctx.fill();
            }
        });
    }

    drawSkeleton(ctx: CanvasRenderingContext2D, keypoints: any[]) {
        const adjacentPairs = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.PoseNet);
        ctx.strokeStyle = 'lime';
        ctx.lineWidth = 2;

        adjacentPairs.forEach(([i, j]) => {
            const kp1 = keypoints[i];
            const kp2 = keypoints[j];
            if (kp1.score > 0.4 && kp2.score > 0.4) {
                ctx.beginPath();
                ctx.moveTo(kp1.x, kp1.y);
                ctx.lineTo(kp2.x, kp2.y);
                ctx.stroke();
            }
        });
    }

    ngOnDestroy() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    }
}
