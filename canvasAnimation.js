/* 
  Canvas Sprite Controller

  Denis Kolpakov (kolpak.me)
  2019
  
  @mainCanvas: <canvas>
  @width: Number
  @height: Number
  @totalFrames: Number
  @getUrlSchema: Function
  @percentLabel: Node
  @isParralelFetch: Boolean
  @loadStep: Number

  Possible states of this.bucket items:
      
  @undefined - empty (Initial state)
  @null - ready to fill up by ImageData (waiting for this.cacheFrame Promise executes)
  @ImageData - done and ready to draw

*/

export default class CanvasSpriteController {
  constructor(params) {
    this.percentLabel = params.percentLabel || null;
    this.mainCanvas = params.mainCanvas;
    this.totalFrames = params.totalFrames;
    this.width = params.width;
    this.height = params.height;
    this.getUrl = frameId => params.getUrlSchema(frameId);
    
    this.virtualCanvas = document.createElement('canvas');
    this.virtualCanvas.setAttribute("width", this.mainCanvas.width);
    this.virtualCanvas.setAttribute("height", this.mainCanvas.height);

    this.bucket = new Array(this.totalFrames);
    this.canvasCtx = this.mainCanvas.getContext('2d');
    this.virtualCtx = this.virtualCanvas.getContext('2d');

    // For internal usage only
    this._loadedFrames = 0;
    this._loadedPercent = 0;

    // If true you'll a fast load, but it might slowing the main thread.
    this.isParralelFetch = params.isParralelFetch || true;

    // Image fetching step
    this.loadStep = params.loadStep || 10; 
  }

  play(frameId) {
    const isFrameNotInBucket = (
      this.bucket[frameId] === null || 
      this.bucket[frameId] === undefined
    );

    if(isFrameNotInBucket) {
      console.log(`Frame #${frameId} lost`)
      return;
    }

    this.draw(this.bucket[frameId]);
  }

  draw(imageData) {
    this.canvasCtx.putImageData(imageData, 0, 0);
  }

  getImageBitmap(url) {
    /* Getting and resolve the ImageData */
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.width = this.virtualCanvas.width;
      img.height = this.virtualCanvas.height;
      img.crossOrigin = "";

      img.onload = () => {
        this.virtualCtx.drawImage(img, 0, 0);
        const ImageData = this.virtualCtx.getImageData(0, 0, img.width, img.height);
        this.virtualCtx.clearRect(0, 0, this.virtualCanvas.width, this.virtualCanvas.height);
        resolve(ImageData);
      }

      img.onerror = (err) => {
        console.log('Cant load file')
        reject(null);
      }
    });
  }

  cacheFrame(frameId) {
    this.bucket[frameId] = null;

    return new Promise((resolve, reject) => {
      const url = this.getUrl(frameId);

      if(this.bucket[frameId] === null) {
        this.getImageBitmap(url)
          .then(ImageData => {
            this.bucket[frameId] = ImageData;
            this._loadedFrames++;
            this._loadedPercent = Math.round((this._loadedFrames/this.totalFrames) * 100);

            resolve(ImageData);

            if(this.percentLabel) {
              this.percentLabel.innerHTML = `${this._loadedPercent}%`;
              if(this._loadedPercent === 100) 
                this.percentLabel.style.opacity = 0;
            }
          })
          .catch(err => {
            this.bucket[frameId] = undefined;
            reject(null);
            console.log('Failed to cache file', url);
          });
      }
    });
  }

  async init(callback) {
    /* Cache the first frame */
    const firstImgData = await this.cacheFrame(1);
    this.draw(firstImgData);

    /* Caching the last frame */
    await this.cacheFrame(this.totalFrames);

    /* Caching the middle frame */
    await this.cacheFrame(Math.round(this.totalFrames/2));

    /* After first 3 images was loaded */
    callback();

    /* Loading in background */
    for(let step = this.loadStep; step >= 1; step--) {
      for(let frameId = step; frameId <= this.totalFrames; frameId += step) {
        if(this.bucket[frameId] === undefined) {
          if(this.isParralelFetch) {
            this.cacheFrame(frameId);
          } else {
            await this.cacheFrame(frameId);
          }
        }
      }
    }
  }
}
