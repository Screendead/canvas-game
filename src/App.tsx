// import Color from 'color';
import React from 'react';
import SimplexNoise from 'simplex-noise';
let GlslCanvas = require('glslCanvas').default;

interface SketchState {
  simplex: SimplexNoise;
  size: number;
  steps: number;
  scale: number;
  timescale: number;
  frame: number;
  repeats: number;
}

class App extends React.Component {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  state: Readonly<SketchState>;
  // interval: NodeJS.Timeout = setTimeout(() => null, 0);

  vertex = `#version 100
  precision mediump float;

  attribute vec4 a_position;
  varying vec4 pixel;

  void main() {
    pixel = a_position;
    gl_Position = a_position;
  }
  `;

  fragment = `#version 100
  precision mediump float;

  uniform float u_time;

  varying vec4 pixel;

  // All components are in the range [0…1], including hue.
  vec3 hsv2rgb(vec3 c)
  {
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  // Simplex 2D noise
  //
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

  float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
      dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
  }
  //	Simplex 3D Noise
  //	by Ian McEwan, Ashima Arts
  //
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

  float snoise(vec3 v){
      const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

      // First corner
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 =   v - i + dot(i, C.xxx) ;

      // Other corners
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );

      //  x0 = x0 - 0. + 0.0 * C
      vec3 x1 = x0 - i1 + 1.0 * C.xxx;
      vec3 x2 = x0 - i2 + 2.0 * C.xxx;
      vec3 x3 = x0 - 1. + 3.0 * C.xxx;

      // Permutations
      i = mod(i, 289.0 );
      vec4 p = permute( permute( permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

      // Gradients
      // ( N*N points uniformly over a square, mapped onto an octahedron.)
      float n_ = 1.0/7.0; // N=7
      vec3  ns = n_ * D.wyz - D.xzx;

      vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);

      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );

      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));

      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);

      //Normalise gradients
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      // Mix final noise value
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
      dot(p2,x2), dot(p3,x3) ) );
  }

  const int OCTAVES = 1;
  float fractal(vec3 v, float lacunarity, float gain) {
      v += vec3(${Math.random() * 100000});

      float sum = 0.0;
      float amplitude = gain;
      float frequency = 1.0;

      for (int i = 0; i < OCTAVES; i++) {
          sum += snoise(v * frequency) * amplitude;
          amplitude *= gain;
          frequency *= lacunarity;
      }

      return sum;
  }

  void main() {
    float h = fractal(vec3(pixel.xy, u_time * 0.25), 2.0, 0.5) * 0.5 + 0.5;
    // h = h + (sin(sqrt(pow(pixel.x, 2.0) + pow(pixel.y, 2.0)) - u_time * 0.5) * 0.5 + 0.5) * 2.0;
    h = mod(h * 4.0, 1.0);
    vec3 hsv = vec3(1.0-h, 1.0, 1.0);
    vec3 rgb = hsv2rgb(hsv);
    gl_FragColor = vec4(rgb, 1.0);
  }
  `;

  constructor(props: any) {
    super(props);

    this.state = {
      simplex: new SimplexNoise(),
      size: 256,
      steps: 16,
      scale: 0.01,
      timescale: 0.01,
      frame: 0,
      repeats: 4,
    };

    this.canvasRef = React.createRef();
  }

  componentDidMount() {
    let canvas = this.canvasRef.current!;

    canvas.setAttribute('width', this.state.size.toString());
    canvas.setAttribute('height', this.state.size.toString());
    canvas.style.width = this.state.size + 'px';
    canvas.style.height = this.state.size + 'px';

    // this.interval = setInterval(() => this.setState({ frames: this.state.frame + 1 }), 0);

    new GlslCanvas(canvas);
    // let sandbox = new GlslCanvas(canvas);
    // sandbox.load(fragment);
  }

  componentWillUnmount() {
    // clearInterval(this.interval);
  }

  componentDidUpdate() {
    let canvas = this.canvasRef.current!;
    let sandbox = new GlslCanvas(canvas);
    sandbox.load(this.fragment, this.vertex);

    // let canvas = this.canvasRef.current!;
    // const ctx = canvas!.getContext('2d')!;
    // if (canvas != null && ctx != null) {
    //   for (let i = 0; i < this.state.size / this.state.steps; i++) {
    //     for (let j = 0; j < this.state.size / this.state.steps; j++) {
    //       const noise = this.state.simplex.noise3D(
    //         i * this.state.scale,
    //         j * this.state.scale,
    //         this.state.frame * this.state.timescale
    //       );
    //       const color = Color({ h: Math.floor((noise * 0.5 + 1) * 360 * this.state.repeats) % 360, s: 100, l: 50 });

    //       ctx.fillStyle = color.hex();
    //       ctx.fillRect(i * this.state.steps, j * this.state.steps, this.state.steps, this.state.steps);

    //       // ctx.strokeStyle = color.hex();
    //       // ctx.strokeRect(i * this.state.steps, j * this.state.steps, this.state.steps, this.state.steps);
    //     }
    //   }
    // }
  }

  render() {
    return <canvas ref={this.canvasRef} className='glslCanvas' data-vertex={this.vertex} data-fragment={this.fragment} id='canvas'></canvas>;
  };
}

export default App;
