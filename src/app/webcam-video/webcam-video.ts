import { Component, ElementRef, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import * as poseDetection from '@tensorflow-models/pose-detection';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
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

    private poseDetector!: poseDetection.PoseDetector;
    private objectDetector!: cocoSsd.ObjectDetection;
    private animationFrameId!: number;
    private detectedObjects: cocoSsd.DetectedObject[] = [];
    private frameCount = 0;
    private lastBallCenter: { x: number; y: number } | null = null;

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

        this.poseDetector = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
        );

        this.objectDetector = await cocoSsd.load();
        console.log('loaded');

        this.detectLoop();
    }

    async detectLoop() {
        const ctx = this.canvas.nativeElement.getContext('2d')!;
        const video = this.video.nativeElement;

        const drawLoop = async () => {
            this.frameCount++;

            // Match canvas to video
            this.canvas.nativeElement.width = video.videoWidth;
            this.canvas.nativeElement.height = video.videoHeight;
            ctx.clearRect(0, 0, video.videoWidth, video.videoHeight);
            ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

            const poses = await this.poseDetector.estimatePoses(video);

            const colorBall = this.detectball(ctx, video);
            if (colorBall) {
                this.drawColorBall(ctx, colorBall);
            }

            // Draw skeleton
            if (poses.length > 0) {
                const keypoints = poses[0].keypoints;
                this.drawKeypoints(ctx, keypoints);
                this.drawSkeleton(ctx, keypoints);
            }

            this.animationFrameId = requestAnimationFrame(drawLoop);
        };

        drawLoop();
    }

    detectball(ctx: CanvasRenderingContext2D, video: HTMLVideoElement) {
        const frame = ctx.getImageData(0, 0, video.videoWidth, video.videoHeight);
        const data = frame.data;

        let count = 0, sumX = 0, sumY = 0;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            if (r > 180 && g > 70 && g < 160 && b < 80) {
                const index = i / 4;
                const x = index % video.videoWidth;
                const y = Math.floor(index / video.videoWidth);
                sumX += x;
                sumY += y;
                count++;
            }
        }

        if (count > 300) {
            const x = sumX / count;
            const y = sumY / count;
            this.lastBallCenter = { x, y };
            return { x, y, radius: 30 };
        } else if (this.lastBallCenter) {
            // Persist previous location briefly for smooth tracking
            return { ...this.lastBallCenter, radius: 30 };
        }

        return null;
    }

    drawColorBall(ctx: CanvasRenderingContext2D, ball: { x: number; y: number; radius: number }) {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, 2 * Math.PI);
        ctx.strokeStyle = 'orange';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = 'rgba(68, 255, 0, 0.2)';
        ctx.fill();
    }
    drawKeypoints(ctx: CanvasRenderingContext2D, keypoints: any[]) {
        const shoulderPoints: any[] = [];
        const footPoints: any[] = [];
    
        keypoints.forEach(kp => {
            if (kp.score > 0.4) {
                ctx.beginPath();
                ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
    
                if (kp.name.includes('shoulder')) {
                    ctx.fillStyle = 'blue';
                    shoulderPoints.push(kp);
                } else if (kp.name.includes('ankle')) {
                    ctx.fillStyle = 'green';
                    footPoints.push(kp);
                } else {
                    ctx.fillStyle = 'red';
                }
                ctx.fill();
            }
        });
    
        if (shoulderPoints.length === 2 && footPoints.length === 2) {
            const [kp1, kp2] = shoulderPoints;
            const [fp1, fp2] = footPoints;
    
            // Top extension
            const dxTop = kp2.x - kp1.x;
            const dyTop = kp2.y - kp1.y;
            const lengthTop = Math.sqrt(dxTop * dxTop + dyTop * dyTop);
            const uxTop = dxTop / lengthTop;
            const uyTop = dyTop / lengthTop;
            const extension = 40;
    
            const topCorner1 = { x: kp1.x - uxTop * extension, y: kp1.y - uyTop * extension };
            const topCorner2 = { x: kp2.x + uxTop * extension, y: kp2.y + uyTop * extension };
    
            // Bottom extension (foot line)
            const dxBottom = fp2.x - fp1.x;
            const dyBottom = fp2.y - fp1.y;
            const lengthBottom = Math.sqrt(dxBottom * dxBottom + dyBottom * dyBottom);
            const uxBottom = dxBottom / lengthBottom;
            const uyBottom = dyBottom / lengthBottom;
    
            const bottomCorner1 = { x: fp1.x - uxBottom * extension, y: fp1.y - uyBottom * extension };
            const bottomCorner2 = { x: fp2.x + uxBottom * extension, y: fp2.y + uyBottom * extension };
    
            // Draw box
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(topCorner1.x, topCorner1.y);
            ctx.lineTo(topCorner2.x, topCorner2.y);
            ctx.lineTo(bottomCorner2.x, bottomCorner2.y);
            ctx.lineTo(bottomCorner1.x, bottomCorner1.y);
            ctx.fillStyle = 'rgba(68, 255, 0, 0.2)'
            ctx.fill();
            ctx.closePath();
            ctx.stroke();
    
            // Draw corner circles
            [topCorner1, topCorner2, bottomCorner1, bottomCorner2].forEach(corner => {
                ctx.beginPath();
                ctx.arc(corner.x, corner.y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = 'red';
                ctx.fill();
            });
        }
    }
    
    drawSkeleton(ctx: CanvasRenderingContext2D, keypoints: any[]) {
        const adjacentPairs = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
    
        adjacentPairs.forEach(([i, j]) => {
            const kp1 = keypoints[i];
            const kp2 = keypoints[j];

            const conf = 0.4;
    
            if (kp1.score > conf && kp2.score > conf) {
                // Set color based on keypoint names
                if (kp1.name.includes('shoulder') || kp2.name.includes('shoulder')) {
                    ctx.strokeStyle = 'orange'; // Shoulders in orange
                } else {
                    ctx.strokeStyle = 'lime';   // Other joints in lime
                }
    
                ctx.lineWidth = 2;
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
