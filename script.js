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

    images.forEach((src) => {
        const img = document.createElement("img");
        img.src = src;
        img.className = "throw-photo";

        const x = Math.random() * window.innerWidth * 0.8;
        const y = Math.random() * window.innerHeight * 0.7;
        const rot = (Math.random() * 40 - 20) + "deg";

        img.style.left = x + "px";
        img.style.top = y + "px";
        img.style.setProperty("--rot", rot);

        layer.appendChild(img);
    });
}
