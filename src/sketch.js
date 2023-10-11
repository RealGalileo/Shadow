export function sketch(p5) {
    p5.setup = () => p5.createCanvas(600, 400, p5.WEBGL);

    p5.draw = () => {
        p5.background(250);
        p5.circle(30, 30, 20);
    };
}