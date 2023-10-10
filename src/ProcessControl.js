import {useRef, useState} from "@types/react";
import {useEffect} from "react";

const shadow1 = new Image();
let shadowMtx;

function ProcessControl() {
    const shadowRef = useRef(null);
    useEffect(() => {
        const shadowElement = shadowRef.current;
        shadow1.onload = () => {
            const shadowCtx = shadowElement.getContext("2d");
            shadowCtx.drawImage(shadow1, 0, 0);
            shadowMtx = shadowCtx.getImageData(0, 0, 640, 480).data;
            console.log(shadowMtx);
        }
        shadow1.src = "/assets/shadow1.png";
    })

return(
    <canvas ref={shadowRef} width="640" height="480" style={{position: "absolute", left: 0, top: 0}}/>
);
}

export default ProcessControl;