import {afterEach, beforeEach, describe, expect, it} from '@jest/globals';
import {MeTTaInterpreter} from '../src/index.js';
import fs from 'fs';
import path from 'path';

describe.skip('ImaginationExtension (Mind Eye)', () => {
    let interp;
    const testDir = path.resolve(process.cwd(), 'metta/tests/test_output_imagination');

    beforeEach(() => {
        interp = new MeTTaInterpreter();
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, {recursive: true});
        }
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, {recursive: true, force: true});
        }
    });

    it('should create a canvas and save an image', () => {
        const imagePath = path.join(testDir, 'test_image.png');

        interp.run(`
            !(let $canvas (canvas-create 200 200)
                (let $ctx (canvas-get-context $canvas)
                    (do
                        (set-color $ctx "red")
                        (draw-rect $ctx 50 50 100 100)
                        (set-color $ctx "blue")
                        (draw-circle $ctx 100 100 25)
                        (save-image $canvas "${imagePath}")
                    )))
        `);

        expect(fs.existsSync(imagePath)).toBe(true);
        const stats = fs.statSync(imagePath);
        expect(stats.size).toBeGreaterThan(0);
    });

    it('should create a key-framed video sequence (GIF)', async () => {
        const videoPath = path.join(testDir, 'test_video.gif');

        interp.run(`
            !(let* (
                    ($canvas (canvas-create 100 100))
                    ($ctx (canvas-get-context $canvas))
                    ($encoder (video-encoder-create 100 100))
                )
                (do
                    (video-start $encoder $canvas "${videoPath}" 100 0)

                    ;; Frame 1
                    (set-color $ctx "white")
                    (draw-rect $ctx 0 0 100 100)
                    (set-color $ctx "red")
                    (draw-circle $ctx 50 50 20)
                    (video-add-frame $encoder $ctx)

                    ;; Frame 2
                    (set-color $ctx "white")
                    (draw-rect $ctx 0 0 100 100)
                    (set-color $ctx "green")
                    (draw-circle $ctx 50 50 30)
                    (video-add-frame $encoder $ctx)

                    ;; Frame 3
                    (set-color $ctx "white")
                    (draw-rect $ctx 0 0 100 100)
                    (set-color $ctx "blue")
                    (draw-circle $ctx 50 50 40)
                    (video-add-frame $encoder $ctx)

                    (video-finish $encoder)
                ))
        `);

        // Wait a small amount for the stream to flush before we check file size
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(fs.existsSync(videoPath)).toBe(true);
        const stats = fs.statSync(videoPath);
        expect(stats.size).toBeGreaterThan(0);
    });
});
