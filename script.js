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

    typeIndex = 0;


    function type(){

        if(typeIndex < text.length){

            element.innerHTML += text.charAt(typeIndex);

            typeIndex++;

            setTimeout(type,80);

        }
        else{

            element.innerHTML += 
            '<span class="cursor">█</span>';

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
    document.getElementById(
        "viewer-content"
    );


    const project =
    projects[key];


    if(!viewer || !project){

        console.log(
            "Project unavailable:",
            key
        );

        return;

    }



    let html = `

    <h2>
    ${safe(project.title)}
    </h2>

    `;



    if(project.images.length){

        html += `

        <h3>
        Evidence
        </h3>

        `;


        project.images.forEach(image=>{


            html += `

            <img
            src="${image}"
            alt="Project Evidence">

            `;


        });


    }




    if(project.pdf){

        html += `


        <h3>
        Report
        </h3>


        <iframe
        src="${project.pdf}">
        </iframe>



        <a
        href="${project.pdf}"
        target="_blank"
        rel="noopener noreferrer"
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


const bg1 =
document.getElementById("bg1");

const bg2 =
document.getElementById("bg2");

const bg3 =
document.getElementById("bg3");





function initBackground(){


    if(!bg1 || !bg2 || !bg3){

        return;

    }



    bg1.style.backgroundImage =
    `url("${gifs[0]}")`;


    bg2.style.backgroundImage =
    `url("${gifs[1]}")`;


    bg3.style.backgroundImage =
    `url("${gifs[2]}")`;


    bg1.style.opacity="1";

    bg2.style.opacity="0";

    bg3.style.opacity="0";


}






function rotateBackground(){


    if(!bg1 || !bg2 || !bg3){

        return;

    }



    backgroundIndex =
    (backgroundIndex + 1)
    %
    gifs.length;



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

        throw new Error(
            `${path} unavailable`
        );

    }



    return await response.json();

}





function safe(value){


    if(
        value === null ||
        value === undefined ||
        value === ""
    ){

        return "Unknown";

    }



    return String(value)

    .replace(
        /</g,
        "&lt;"
    )

    .replace(
        />/g,
        "&gt;"
    );

}





function formatDate(value){


    if(!value){

        return "Unknown";

    }


    const date =
    new Date(value);


    if(
        Number.isNaN(
            date.getTime()
        )
    ){

        return safe(value);

    }


    return date.toLocaleString();

}

 
/* =========================
   PROJECT CLICK HANDLERS
========================= */


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
    document.getElementById(
        "disaster-feed"
    );



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

        .forEach(
        ([category,events])=>{


            if(!Array.isArray(events)){

                return;

            }



            html += `


            <div class="intel-item">


            <h3>

            ${safe(category.toUpperCase())}

            </h3>


            `;



            events
            .slice(0,3)
            .forEach(event=>{


                html += `


                <hr>


                <b>
                ${safe(event.title)}
                </b>


                <br><br>


                Location:

                ${safe(event.location)}


                <br>


                Severity:

                ${safe(event.severity)}


                <br>


                Source:

                ${safe(event.source)}


                <br>


                Geometry:

                ${safe(event.geometry)}


                `;



            });



            html += `


            </div>


            `;



        });



        feed.innerHTML = html;



    }
    catch(error){


        console.error(
            "Disaster feed error:",
            error
        );



        feed.innerHTML = `


        <div class="status-alert">

        ● DISASTER INTELLIGENCE OFFLINE

        </div>


        `;


    }


}








/* =========================
   EWS MONITOR
========================= */


async function loadEWS(){


    const feed =
    document.getElementById(
        "ews-feed"
    );



    if(!feed){

        return;

    }



    try{


        const data =
        await fetchJSON(
            "data/ews_state.json"
        );



        feed.innerHTML = `


        <div class="intel-status">

        ● EWS MONITOR ONLINE

        </div>


        <div class="intel-item">


        <b>
        Status Level:
        </b>

        ${safe(data.level)}/5


        <br><br>


        <b>
        Tracked Aircraft:
        </b>

        ${safe(data.concurrent_count)}


        <br><br>


        <b>
        Anomaly Score:
        </b>

        ${safe(data.z_score)}σ


        <br><br>


        <b>
        Last Checked:
        </b>

        ${formatDate(data.last_checked)}


        <br><br>


        <b>
        Updated:
        </b>

        ${formatDate(data.as_of)}


        </div>


        `;



    }
    catch(error){


        console.error(
            "EWS error:",
            error
        );



        feed.innerHTML = `


        <div class="status-alert">

        ● EWS FEED OFFLINE

        </div>


        `;


    }


}








/* =========================
   AI CYBER DIGEST
========================= */


async function loadAINews(){


    const feed =
    document.getElementById(
        "ai-news-feed"
    );


    if(!feed){

        return;

    }



    try{


        const data =
        await fetchJSON(
            "data/ai_cyber_digest.json"
        );



        let html = `


        <div class="intel-status">

        ● AI CYBER DIGEST ONLINE

        </div>


        `;



        if(

            Array.isArray(data.stories)

            &&

            data.stories.length

        ){



            data.stories

            .slice(0,5)

            .forEach((story,index)=>{


                html += `


                <div class="intel-item">


                <h3>

                ${index + 1}. ${safe(story.title)}

                </h3>



                <b>

                Source:

                </b>

                ${safe(story.source)}


                <br><br>



                <b>

                Category:

                </b>

                ${safe(story.category)}


                <br><br>



                ${safe(story.summary)}



                <br><br>



                <b>

                Intelligence Score:

                </b>

                ${safe(story.score)}



                <br><br>



                <a

                href="${safe(story.link)}"

                target="_blank"

                rel="noopener noreferrer"

                class="project-link"

                >

                Read Full Report →

                </a>



                </div>


                `;


            });



        }

        else{


            html += `


            <div class="intel-item">


            No intelligence reports available.


            </div>


            `;


        }



        feed.innerHTML = html;



    }


    catch(error){


        console.error(

            "AI digest error:",

            error

        );



        feed.innerHTML = `


        <div class="status-alert">


        ● AI INTELLIGENCE OFFLINE


        </div>


        `;


    }


}


/* =========================
   DISASTER MAP
========================= */


let disasterMap = null;





function getEventColor(type){


    switch(type){


        case "earthquake":

            return "red";


        case "volcano":

            return "orange";


        case "weather":

            return "purple";


        case "solar":

            return "yellow";


        default:

            return "#00ffff";


    }


}






function addPointEvent(event){


    if(!event.coordinates){

        return;

    }



    const lat =
    Number(
        event.coordinates.lat
    );


    const lon =
    Number(
        event.coordinates.lon
    );



    if(

        Number.isNaN(lat) ||

        Number.isNaN(lon)

    ){

        return;

    }



    const color =
    getEventColor(
        event.type
    );



    L.circleMarker(

        [
            lat,
            lon
        ],

        {

            radius:8,

            color:color,

            fillColor:color,

            fillOpacity:.75

        }

    )

    .addTo(
        disasterMap
    )

    .bindPopup(`


        <b>
        ${safe(event.title)}
        </b>


        <br><br>


        Type:

        ${safe(event.type)}


        <br>


        Severity:

        ${safe(event.severity)}


        <br>


        Location:

        ${safe(event.location)}



    `);


}









function addPolygonEvent(event){


    if(

        !event.coordinates ||

        !Array.isArray(
            event.coordinates.polygon
        )

    ){

        return;

    }




    const color =
    getEventColor(
        event.type
    );





    event.coordinates.polygon

    .forEach(
    ring=>{


        if(
            !Array.isArray(ring)
        ){

            return;

        }




        const leafletPoints =

        ring

        .map(point=>{


            if(

                !Array.isArray(point) ||

                point.length < 2

            ){

                return null;

            }



            const longitude =
            Number(
                point[0]
            );


            const latitude =
            Number(
                point[1]
            );



            if(

                Number.isNaN(latitude) ||

                Number.isNaN(longitude)

            ){

                return null;

            }



            return [

                latitude,

                longitude

            ];



        })

        .filter(Boolean);





        if(
            leafletPoints.length < 3
        ){

            return;

        }





        L.polygon(

            leafletPoints,

            {

                color:color,

                fillColor:color,

                fillOpacity:.25,

                weight:2

            }

        )

        .addTo(
            disasterMap
        )

        .bindPopup(`


            <b>
            ${safe(event.title)}
            </b>


            <br><br>


            Type:

            ${safe(event.type)}


            <br>


            Severity:

            ${safe(event.severity)}


            <br>


            Location:

            ${safe(event.location)}



        `);



    });


}










async function loadDisasterMap(){


    const map =
    document.getElementById(
        "disaster-map"
    );



    if(!map){

        return;

    }



    if(typeof L === "undefined"){

        console.error(
            "Leaflet not loaded"
        );

        return;

    }





    if(disasterMap){

        disasterMap.remove();

    }






    disasterMap =

    L.map(
        "disaster-map"
    )

    .setView(

        [
            20,
            0
        ],

        2

    );






    L.tileLayer(

        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",

        {

            attribution:
            "© OpenStreetMap contributors"

        }


    )

    .addTo(
        disasterMap
    );







    try{


        const data =

        await fetchJSON(

            "data/disaster_state.json"

        );




        const history =

        data.history || {};




        let events = [];




        Object.values(history)

        .forEach(category=>{


            if(
                Array.isArray(category)
            ){

                events =
                events.concat(category);

            }


        });






        events.forEach(event=>{


            if(!event){

                return;

            }



            /*
                Point events:

                USGS
                NOAA point alerts

            */


            if(

                event.coordinates &&

                event.coordinates.lat !== undefined &&

                event.coordinates.lon !== undefined

            ){


                addPointEvent(event);


                return;


            }




            /*
                Polygon events:

                NOAA weather alerts

            */


            if(

                event.coordinates &&

                Array.isArray(
                    event.coordinates.polygon
                )

            ){


                addPolygonEvent(event);


                return;


            }




            // Empty coordinates ignored

        });




    }
    catch(error){


        console.error(

            "Map loading error:",

            error

        );


    }



}









/* =========================
   START APPLICATION
========================= */


document.addEventListener(

"DOMContentLoaded",

()=>{


    startTypewriter();


    loadIntelligence();


    loadDisasterMap();



}

);
