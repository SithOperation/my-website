const text = "system online...";
let typeIndex = 0;


/* =========================
   TYPEWRITER
========================= */

function startTypewriter(){

    const element = document.getElementById("typing");

    if(!element){
        return;
    }

    element.innerHTML = "";

    function type(){

        if(typeIndex < text.length){

            element.innerHTML += text.charAt(typeIndex);

            typeIndex++;

            setTimeout(type,80);

        }
        else{

            element.innerHTML += '<span class="cursor">█</span>';

        }

    }

    type();

}


/* =========================
   PROJECT MODULES
========================= */


const projects = {

    reddit: {

        title:"Reddit Threat Monitor",

        images:[
            "assets/projects/reddit/image1.jpg",
            "assets/projects/reddit/image2.jpg",
            "assets/projects/reddit/image3.jpg",
            "assets/projects/reddit/image4.jpg",
            "assets/projects/reddit/image5.jpg"
        ],

        pdf:null

    },


    ransomware: {

        title:"Healthcare Ransomware Defense",

        images:[],

        pdf:"assets/projects/project2.pdf"

    },


    nestle: {

        title:"Nestle CIA Threat Table",

        images:[],

        pdf:"assets/projects/project1.pdf"

    }

};



function loadProject(key){

    const viewer =
    document.getElementById("viewer-content");


    const project =
    projects[key];


    if(!viewer || !project){

        return;

    }


    let html = `
    <h2>${project.title}</h2>
    `;


    if(project.images.length){

        html += `<h3>Evidence</h3>`;

        project.images.forEach(image=>{

            html += `
            <img src="${image}" alt="Project Evidence">
            `;

        });

    }



    if(project.pdf){

        html += `

        <h3>Report</h3>

        <iframe src="${project.pdf}"></iframe>

        <a 
        href="${project.pdf}"
        target="_blank"
        class="project-link">

        Open Full PDF

        </a>

        `;

    }


    viewer.innerHTML = html;


    viewer.scrollIntoView({

        behavior:"smooth",

        block:"center"

    });

}


window.loadProject = loadProject;



document.addEventListener(
"DOMContentLoaded",
()=>{

    document
    .querySelectorAll("[data-project]")
    .forEach(card=>{

        card.addEventListener(
        "click",
        ()=>{

            loadProject(
                card.dataset.project
            );

        });

    });

});


/* =========================
   BACKGROUND ROTATION
========================= */


const gifs = [

"assets/i-made-some-gifs-v0-9yugvn57e5o81.gif",
"assets/i-made-some-gifs-v0-fphci857e5o81.gif",
"assets/i-made-some-gifs-v0-uhn1le67e5o81.gif",
"assets/i-made-some-gifs-v0-vv91pq57e5o81.gif"

];


gifs.forEach(src=>{

    const image = new Image();

    image.src = src;

});


let backgroundIndex = 0;


const bg1=document.getElementById("bg1");
const bg2=document.getElementById("bg2");
const bg3=document.getElementById("bg3");



function initBackground(){

    if(!bg1 || !bg2 || !bg3){
        return;
    }


    bg1.style.backgroundImage=`url("${gifs[0]}")`;

    bg2.style.backgroundImage=`url("${gifs[1]}")`;

    bg3.style.backgroundImage=`url("${gifs[2]}")`;

}



function rotateBackground(){

    if(!bg1 || !bg2 || !bg3){
        return;
    }


    backgroundIndex =
    (backgroundIndex + 1) % gifs.length;


    bg3.style.backgroundImage =
    `url("${gifs[backgroundIndex]}")`;


    bg3.style.opacity="1";


    setTimeout(()=>{

        bg1.style.backgroundImage =
        bg3.style.backgroundImage;

        bg1.style.opacity="1";

        bg3.style.opacity="0";


    },1500);

}


initBackground();

setInterval(
rotateBackground,
6000
);



/* =========================
   HELPERS
========================= */


async function fetchJSON(path){

    const response =
    await fetch(
        `${path}?cache=${Date.now()}`
    );


    if(!response.ok){

        throw new Error(path);

    }


    return await response.json();

}



function safe(value){

    if(value === null || value === undefined){

        return "Unknown";

    }


    return String(value)
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");

}



/* =========================
   INTELLIGENCE LOADER
========================= */


function loadIntelligence(){

    loadDisasterIntelligence();

    loadEWS();

    loadAINews();

}




/* =========================
   DISASTER FEED
========================= */


async function loadDisasterIntelligence(){

const feed =
document.getElementById("disaster-feed");


if(!feed){
    return;
}


try{


const data =
await fetchJSON(
"data/disaster_state.json"
);



const history =
data.history || {};



let html = `

<div class="intel-status">

● DISASTER INTELLIGENCE ONLINE

</div>

`;



Object.entries(history)
.forEach(([type,events])=>{


html += `

<div class="intel-item">

<h3>
${type.toUpperCase()}
</h3>

`;



events
.slice(0,2)
.forEach(event=>{


html += `

<hr>

<b>
${safe(event.title)}
</b>

<br>

Location:
${safe(event.location)}

<br>

Severity:
${safe(event.severity)}

<br>

Source:
${safe(event.source)}

`;

});


html += `</div>`;


});



feed.innerHTML = html;



}
catch(error){

console.log(error);


feed.innerHTML=

`
<div class="status-alert">
● DISASTER INTELLIGENCE OFFLINE
</div>
`;

}



}



/* =========================
   EWS
========================= */


async function loadEWS(){

const feed =
document.getElementById("ews-feed");


if(!feed){
return;
}


try{


const data =
await fetchJSON(
"data/ews_state.json"
);



feed.innerHTML=`

<div class="intel-status">
● EWS MONITOR ONLINE
</div>


<div class="intel-item">

<b>Status Level:</b>
${safe(data.level)}/5

<br>

<b>Tracked Aircraft:</b>
${safe(data.concurrent_count)}

<br>

<b>Anomaly Score:</b>
${safe(data.z_score)}σ

<br>

<b>Updated:</b>
${safe(data.as_of)}

</div>

`;



}
catch(error){


feed.innerHTML=

`
<div class="status-alert">
● EWS FEED OFFLINE
</div>
`;

}


}



/* =========================
   AI DIGEST
========================= */


async function loadAINews(){

const feed =
document.getElementById("ai-news-feed");


if(!feed){
return;
}



try{


const data =
await fetchJSON(
"data/ai_cyber_digest_state.json"
);



let html = `

<div class="intel-status">
● AI CYBER DIGEST ONLINE
</div>

`;



if(data.reports && data.reports.length){


data.reports
.slice(0,5)
.forEach(report=>{


html += `

<div class="intel-item">

<b>
${safe(report.title)}
</b>

<br><br>

Source:
${safe(report.source)}

<br><br>

${safe(report.summary)}

<br><br>

Security Impact:

<br>

${safe(report.impact)}

<br><br>

<a href="${safe(report.link)}"
target="_blank">

Read Full Report

</a>


</div>

`;


});


}
else{


html += `

<div class="intel-item">

Last Digest:
${safe(data.last_digest)}

<br><br>

No report entries available.

</div>

`;

}



feed.innerHTML = html;



}
catch(error){


feed.innerHTML=

`
<div class="status-alert">
● AI INTELLIGENCE OFFLINE
</div>
`;

}



}



/* =========================
   DISASTER MAP
========================= */


let disasterMap=null;



function addMapPoint(event){


if(!event.coordinates){
return;
}



const lat =
Number(event.coordinates.lat);


const lon =
Number(event.coordinates.lon);



if(
Number.isNaN(lat) ||
Number.isNaN(lon)
){

return;

}



L.circleMarker(
[lat,lon],
{

radius:8,

color:"#00ffff",

fillOpacity:.7

}

)

.addTo(disasterMap)

.bindPopup(`

<b>
${safe(event.title)}
</b>

<br>

${safe(event.location)}

`);

}



function addPolygon(event){


if(
!event.coordinates ||
!event.coordinates.polygon
){

return;

}



L.polygon(
event.coordinates.polygon.map(
ring=>

ring.map(point=>[
point[1],
point[0]
])

)

)

.addTo(disasterMap)

.bindPopup(
safe(event.title)
);

}





async function loadDisasterMap(){


const map =
document.getElementById(
"disaster-map"
);



if(!map || typeof L==="undefined"){

return;

}



disasterMap =
L.map("disaster-map")
.setView(
[20,0],
2
);



L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png",

{

attribution:
"© OpenStreetMap contributors"

}

)

.addTo(disasterMap);



try{


const data =
await fetchJSON(
"data/disaster_state.json"
);



const history =
data.history || {};



Object.values(history)
.flat()
.forEach(event=>{


if(event.geometry==="point"){

addMapPoint(event);

}


if(event.geometry==="Polygon"){

addPolygon(event);

}


});


}
catch(error){

console.log(
"Map error",
error
);

}


}



/* =========================
   START
========================= */


document.addEventListener(
"DOMContentLoaded",
()=>{

startTypewriter();

loadIntelligence();

loadDisasterMap();

});
