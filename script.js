const text = "system online...";
let i = 0;

function type() {
    if (i < text.length) {
        document.getElementById("typing").innerHTML += text.charAt(i);
        i++;
        setTimeout(type, 80);
    }
}

type();

function throwPhotos() {
    const layer = document.getElementById("photo-layer");

    layer.innerHTML = "";

    const images = [
        "projects/image1.jpg",
        "projects/image2.jpg",
        "projects/image3.jpg",
        "projects/image4.jpg",
        "projects/image5.jpg"
    ];

    const positions = [
    { left: "8%",  top: "18%", rot: "-14deg" },
    { left: "33%", top: "8%",  rot: "8deg" },
    { left: "60%", top: "16%", rot: "-7deg" },
    { left: "18%", top: "48%", rot: "10deg" },
    { left: "48%", top: "46%", rot: "-9deg" }
];

images.forEach((src, index) => {

    const img = document.createElement("img");

    img.src = src;
    img.className = "throw-photo";

    const pos = positions[index];

    img.style.left = pos.left;
    img.style.top = pos.top;
    img.style.setProperty("--rot", pos.rot);

    layer.appendChild(img);

});
}
