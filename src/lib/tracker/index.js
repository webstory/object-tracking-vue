/**
 * Original code from
 * @see https://github.com/cloud-annotations/object-tracking-js
 *
 * Author: Hoya Kim <wbstory@storymate.net>
 * @version 0.0.6
 * Changes:
 *  - Modified to the Modern javascript class style
 *  - Tensorflow Version updated from 1.x to 3.x
 *  - Change tracking behavior from gradually taking reference to fixed image based
 */
import * as tf from "@tensorflow/tfjs";
import * as np from "./math-util";
tf.enableProdMode();

export class ObjectTracker {
  static SIGMA = 100;
  static LEARNING_RATE = 0.125;

  static clamp = (x, lower, upper) => Math.max(lower, Math.min(x, upper));

  constructor(frame, [left, top, width, height]) {
    const SIGMA = ObjectTracker.SIGMA;
    const LEARNING_RATE = ObjectTracker.LEARNING_RATE;

    const [_rect, _Ai, _Bi, gaussFourier, fourierMatrix] = tf.tidy(() => {
      // Process image.
      const image = tf.browser.fromPixels(frame);
      const greyscaleImage = np.rgbToGrayscale(image);
      const imageCrop = greyscaleImage.slice([top, left], [height, width]);
      const processedImage = np.preprocessImage(imageCrop);

      // Create gaussian blur centered at the region of interest.
      const center = [top + height / 2, left + width / 2];
      const gaussTensor = np.gauss(image.shape, center, SIGMA);
      const gaussCrop = gaussTensor.slice([top, left], [height, width]);

      // The rectangle is always the same size so we can just calculate the
      // fourier matrix once.
      const fourierMatrix = np.calculateFourierMatrix([height, width]);

      // Calculate Ai and Bi.
      const gaussFourier = np.dft(gaussCrop, fourierMatrix);
      const imageFourier = np.dft(imageCrop, fourierMatrix);
      const processedImageFourier = np.dft(processedImage, fourierMatrix);

      const Ai = np.complexMul(
        np.complexMul(gaussFourier, np.conjugate(processedImageFourier)),
        LEARNING_RATE
      );
      const Bi = np.complexMul(
        np.complexMul(imageFourier, np.conjugate(imageFourier)),
        LEARNING_RATE
      );

      return [[left, top, width, height], Ai, Bi, gaussFourier, fourierMatrix];
    });

    this.rect = _rect;
    this.Ai = Object.freeze(_Ai);
    this.Bi = Object.freeze(_Bi);
    this.fourierMatrix = Object.freeze(fourierMatrix);
  }

  async next(frame) {
    const [left, top, width, height] = this.rect;
    const fourierMatrix = this.fourierMatrix;
    const Ai = this.Ai;
    const Bi = this.Bi;

    const newRect = tf.tidy(() => {
      // Process image.
      const image = tf.browser.fromPixels(frame);
      const greyscaleImage = np.rgbToGrayscale(image);
      const imageCrop = greyscaleImage.slice([top, left], [height, width]);
      const processedImage = np.preprocessImage(imageCrop);

      // Calculate dx/dy
      const Hi = np.complexDiv(Ai, Bi);

      const Gi = np.complexMul(Hi, np.dft(processedImage, fourierMatrix));
      const gi = np.dft(Gi, fourierMatrix);

      const normalizedGi = np.normalize(gi[0]);

      const maxValue = tf.max(normalizedGi);
      const positions = np.findIndex2d(normalizedGi, maxValue);

      const delta = tf
        .mean(positions, 1)
        .sub([normalizedGi.shape[0] / 2, normalizedGi.shape[1] / 2])
        .round();

      const [dy, dx] = delta.dataSync();

      // Clipping:
      // raw:     [________XXX]XXX
      // clipped: [_____XXXXXX]
      const newRect = [
        ObjectTracker.clamp(left - dx, 0, image.shape[1] - width),
        ObjectTracker.clamp(top - dy, 0, image.shape[0] - height),
        width,
        height
      ];
      return newRect;
    });

    this.rect = newRect;
    return newRect;
  }
}
