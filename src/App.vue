<template>
  <h1>Draw a box to start tracking</h1>
  <select v-model="selectedValue" @change="onChange">
    <option
      value="https://itrc-demo.storymate.net/vid/object-tracking/JetFlyby.mp4"
      selected
    >
      Jet Flyby
    </option>
    <option
      value="https://itrc-demo.storymate.net/vid/object-tracking/test_video1.mp4"
    >
      Highway
    </option>
  </select>
  <div
    class="overlay-wrapper"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
  >
    <video
      class="non-interactive"
      ref="videoRef"
      crossorigin="anonymous"
      muted
      controls
      @loadedmetadata="onLoadedMetadata"
      @canplay="onCanPlay"
      :width="videoWidth"
      :height="videoHeight"
    >
      <source :src="videoSrc" type="video/mp4" />
    </video>
    <canvas
      ref="canvasRef"
      class="box non-interactive"
      :width="videoWidth"
      :height="videoHeight"
    />
    <div class="box non-interactive" v-bind:style="boxPosition">&nbsp;</div>
  </div>
</template>

<script>
import { ObjectTracker } from "./lib/tracker";

const normalizeBoxSize = (box) => {
  if (!box) {
    return [0, 0, 0, 0];
  }
  const [x, y, width, height] = box;
  return [
    Math.round(width < 0 ? x - Math.abs(width) : x),
    Math.round(height < 0 ? y - Math.abs(height) : y),
    Math.round(Math.abs(width)),
    Math.round(Math.abs(height)),
  ];
};

export default {
  name: "App",
  components: {},
  data() {
    return {
      videoWidth: 480,
      videoHeight: 360,
      videoSrc:
        "https://itrc-demo.storymate.net/vid/object-tracking/JetFlyby.mp4",
      selectedValue:
        "https://itrc-demo.storymate.net/vid/object-tracking/JetFlyby.mp4",
      drawing: false,
      box: [0, 0, 0, 0],
      tracker: null,
      animationTimer: -1,
    };
  },
  computed: {
    boxPosition() {
      return {
        left: Math.round(this.box[0]) + "px",
        top: Math.round(this.box[1]) + "px",
        width: Math.round(this.box[2]) + "px",
        height: Math.round(this.box[3]) + "px",
        border: "2px solid yellow",
        boxSizing: "border-box",
      };
    },
  },
  methods: {
    onChange(e) {
      cancelAnimationFrame(this.animationTimer);
      const videoRef = this.$refs.videoRef;
      videoRef.pause();
      this.videoSrc = e.target.value;
      videoRef.load();
    },
    handleMouseDown(e) {
      this.drawing = true;
      // if(!e.clientX || !e.clientY) {
      //   e = e.touches[0];
      // }

      const canvasRect = this.$refs.canvasRef.getBoundingClientRect();
      const mX = e.clientX - canvasRect.left;
      const mY = e.clientY - canvasRect.top;

      this.box = [
        Math.min(this.$refs.canvasRef.width, Math.max(0, mX)),
        Math.min(this.$refs.canvasRef.height, Math.max(0, mY)),
        0,
        0,
      ];
    },
    handleMouseMove(e) {
      if (!this.drawing) return;

      const canvasRect = this.$refs.canvasRef.getBoundingClientRect();
      const mX = Math.min(
        this.$refs.canvasRef.width,
        Math.max(0, e.clientX - canvasRect.left)
      );
      const mY = Math.min(
        this.$refs.canvasRef.height,
        Math.max(0, e.clientY - canvasRect.top)
      );

      this.box = [this.box[0], this.box[1], mX - this.box[0], mY - this.box[1]];
    },
    handleMouseUp() {
      this.drawing = false;
      this.tracker = new ObjectTracker(
        this.$refs.videoRef,
        normalizeBoxSize(this.box)
      );
      this.trackAndRender();
      this.$refs.videoRef.play();
    },
    renderBox(box) {
      const ctx = this.$refs.canvasRef.getContext("2d");
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "red";
      ctx.strokeRect(box[0], box[1], box[2], box[3]);
    },
    async trackAndRender() {
      this.animationTimer = requestAnimationFrame(async () => {
        const box = await this.tracker.next(this.$refs.videoRef);
        this.renderBox(box);
        this.trackAndRender();
      });
    },
    onLoadedMetadata() {
      const videoRef = this.$refs.videoRef;
      this.videoWidth = videoRef.videoWidth;
      this.videoHeight = videoRef.videoHeight;
    },
    onCanPlay() {
      // Do nothing
    },
  },
};
</script>

<style lang="scss" scoped>
.overlay-wrapper {
  position: relative;
}

.box {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
}

.non-interactive {
  pointer-events: none;
}
</style>
