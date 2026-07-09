// =====================
// TYPEWRITER
// =====================

const text = "system online...";
let i = 0;

function type() {

    const el = document.getElementById("typing");

    if (!el) return;


    if (i === 0) {
        el.innerHTML = "";
    }


    if (i < text.length) {

        el.innerHTML += text.charAt(i);

        i++;

        setTimeout(type, 80);

    } else {

        el.innerHTML += '<span class="cursor">█</span>';

    }

}


type();




// =====================
// PROJECT DATA
// =====================

const projects = {

    reddit: {

        title: "Reddit Threat Monitor",

        images: [

            "assets/projects/reddit/image1.jpg",
            "assets/projects/reddit/image2.jpg",
            "assets/projects/reddit/image3.jpg",
            "assets/projects/reddit/image4.jpg",
            "assets/projects/reddit/image5.jpg"

        ],

        pdf: null

    },


    ransomware: {

        title: "Healthcare Ransomware Defense",

        images: [],

        pdf: "assets/projects/project2.pdf"

    },


    nestle: {

        title: "Nestle CIA Threat Table",

        images: [],

        pdf: "assets/projects/project1.pdf"

    }

};





// =====================
// PROJECT VIEWER
// FIXED CLICK SYSTEM
// =====================


function loadProject(key) {


    const viewer =
    document.getElementById(
        "viewer-content"
    );


    const project =
    projects[key];


    if(!viewer || !project){

        console.log(
            "Project missing:",
            key
        );

        return;

    }



    let html = `

    <h2>
    ${project.title}
    </h2>

    `;



    // IMAGES

    if(project.images && project.images.length > 0){


        html += `

        <h3>
        Evidence
        </h3>

        `;



        project.images.forEach(img => {


            html += `

            <img 
            src="${img}"
            alt="Project Evidence">

            `;


        });


    }




    // PDF

    if(project.pdf){


        html += `


        <h3>
        Report
        </h3>


        <iframe
        src="${project.pdf}">
        </iframe>


        <br><br>


        <a 
        href="${project.pdf}"
        target="_blank"
        class="project">

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





// =====================
// BACKGROUND GIF SYSTEM
// =====================


const gifs = [

"assets/i-made-some-gifs-v0-9yugvn57e5o81.gif",

"assets/i-made-some-gifs-v0-fphci857e5o81.gif",

"assets/i-made-some-gifs-v0-uhn1le67e5o81.gif",

"assets/i-made-some-gifs-v0-vv91pq57e5o81.gif"

];



gifs.forEach(src=>{

    const img =
    new Image();

    img.src = src;

});



let index = 0;



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
    `url('${gifs[0]}')`;


    bg2.style.backgroundImage =
    `url('${gifs[1]}')`;


    bg3.style.backgroundImage =
    `url('${gifs[2]}')`;



    bg1.style.opacity="1";

    bg2.style.opacity="0";

    bg3.style.opacity="0";


}





function rotateBackground(){


    if(!bg1 || !bg2 || !bg3){

        return;

    }



    index =
    (index + 1)
    %
    gifs.length;



    const next =
    gifs[index];



    bg1.style.backgroundImage =
    bg2.style.backgroundImage;



    bg2.style.backgroundImage =
    bg3.style.backgroundImage;



    bg3.style.backgroundImage =
    `url('${next}')`;



    bg3.style.opacity="1";

    bg2.style.opacity=".6";

    bg1.style.opacity=".2";



    setTimeout(()=>{


        bg1.style.backgroundImage =
        bg2.style.backgroundImage;


        bg2.style.opacity="0";


        bg1.style.opacity="1";


    },1500);


}



initBackground();


setInterval(
rotateBackground,
6000
);

// =============================
// INTELLIGENCE CENTER
// =============================

async function loadIntelligence(){

    loadDisasterIntelligence();

    loadEWS();

    loadAINews();

}



// =============================
// DISASTER INTELLIGENCE
// =============================


async function loadDisasterIntelligence(){


    const feed =
    document.getElementById(
        "disaster-feed"
    );



    if(!feed){

        return;

    }



    try{


        const response =
        await fetch(
            "data/disaster_state.json?cache=" + Date.now()
        );



        const data =
        await response.json();



        const history =
        data.history || {};



        let html = `


        <div class="intel-status status-online">

        ● DISASTER INTELLIGENCE ONLINE

        </div>


        `;



        const categories = [


            {
                title:"🌎 EARTHQUAKES",
                key:"earthquakes"
            },


            {
                title:"🌋 VOLCANOES",
                key:"volcanoes"
            },


            {
                title:"☀️ SOLAR ACTIVITY",
                key:"solar"
            },


            {
                title:"⛈ WEATHER",
                key:"weather"
            }


        ];




        categories.forEach(category=>{


            html += `


            <div class="intel-item">


            <h3>

            ${category.title}

            </h3>


            `;



            const events =
            history[category.key] || [];




            if(events.length === 0){


                html += `

                No recent events detected.

                `;


            }

            else{


                events
                .slice(0,2)
                .forEach(event=>{


                    html += `


                    <hr>


                    <b>
                    ${event.title || "Unknown Event"}
                    </b>


                    <br><br>


                    Location:

                    ${event.location || "Unknown"}


                    <br>


                    Severity:

                    ${event.severity || "Unknown"}


                    <br>


                    Source:

                    ${event.source || "Unknown"}


                    <br>


                    `;


                });


            }



            html += `

            </div>

            `;


        });



        feed.innerHTML =
        html;



    }

    catch(error){


        console.log(
            "Disaster intelligence error:",
            error
        );



        feed.innerHTML = `


        <div class="status-alert">

        ● DISASTER INTELLIGENCE OFFLINE

        </div>


        `;


    }


}







// =============================
// EARLY WARNING SYSTEM
// =============================


async function loadEWS(){


    const feed =
    document.getElementById(
        "ews-feed"
    );



    if(!feed){

        return;

    }



    try{


        const response =
        await fetch(
            "data/ews_state.json?cache=" + Date.now()
        );



        const data =
        await response.json();




        feed.innerHTML = `


        <div class="intel-status status-online">

        ● EWS MONITOR ONLINE

        </div>




        <div class="intel-item">


        ✈️ EARLY WARNING SYSTEM


        <br><br>



        <b>
        Status Level:
        </b>

        ${data.level ?? "N/A"}/5


        <br>


        <b>
        Tracked Aircraft:
        </b>

        ${data.concurrent_count ?? "N/A"}


        <br>


        <b>
        Anomaly Score:
        </b>


        ${
            data.z_score !== undefined
            ?
            Number(data.z_score).toFixed(2)
            :
            "N/A"
        }σ


        <br>


        <b>
        Updated:
        </b>


        ${data.as_of ?? "Unknown"}



        </div>


        `;



    }

    catch(error){


        console.log(
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








// =============================
// AI CYBER DIGEST
// =============================


async function loadAINews(){


    const feed =
    document.getElementById(
        "ai-news-feed"
    );



    if(!feed){

        return;

    }



    try{


        const response =
        await fetch(
            "output/latest_digest.md?cache=" + Date.now()
        );



        if(!response.ok){

            throw new Error(
                "Digest unavailable"
            );

        }



        const markdown =
        await response.text();



        const reports =
        markdown
        .split("\n## ")
        .slice(1);




        let html = `


        <div class="intel-status status-online">

        ● AI CYBER DIGEST ONLINE

        </div>


        `;




        reports
        .slice(0,5)
        .forEach(
        (report,index)=>{


            const lines =
            report.split("\n");



            const title =
            lines.shift();



            const content =
            lines.join("\n");



            const sourceMatch =
            content.match(
                /\*\*Source:\*\* (.*)/
            );



            const source =
            sourceMatch
            ?
            sourceMatch[1]
            :
            "Unknown";



            const summary =
            content
            .split(
                "**Security Impact:**"
            )[0]
            .replace(
                /\*\*Source:\*\*.*\n/,
                ""
            )
            .trim();



            const impactMatch =
            content.match(
                /\*\*Security Impact:\*\*\n([\s\S]*?)\n\nLink:/
            );



            const impact =
            impactMatch
            ?
            impactMatch[1]
            :
            "No impact analysis available";



            const linkMatch =
            content.match(
                /Link:\n(.*)/
            );



            const link =
            linkMatch
            ?
            linkMatch[1]
            :
            "#";




            html += `


            <div class="intel-item">


            🤖 INTEL REPORT #${index + 1}


            <br><br>



            <b>
            ${title}
            </b>



            <br><br>



            <b>
            Source:
            </b>


            ${source}



            <br><br>



            <b>
            Analyst Summary:
            </b>


            <br>


            ${summary}



            <br><br>



            <b>
            Security Impact:
            </b>


            <br>


            ${impact.replace(/\n/g,"<br>")}



            <br><br>



            <a href="${link}"
            target="_blank">

            Read Full Report

            </a>



            </div>


            `;



        });



        html += `


        <p>

        Last Updated:

        ${new Date().toUTCString()}

        </p>


        `;



        feed.innerHTML =
        html;



    }

    catch(error){


        console.log(
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

// =============================
// GLOBAL DISASTER MAP
// =============================

let disasterMap = null;



async function loadDisasterMap(){


    const mapElement =
    document.getElementById(
        "disaster-map"
    );



    if(!mapElement){

        console.log(
            "Disaster map element missing"
        );

        return;

    }



    // Prevent Leaflet duplicate initialization

    if(disasterMap){

        disasterMap.remove();

        disasterMap = null;

    }



    disasterMap = L.map(
        "disaster-map"
    ).setView(

        [20,0],

        2

    );



    L.tileLayer(

        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",

        {

            attribution:
            "© OpenStreetMap contributors"

        }

    ).addTo(
        disasterMap
    );




    try{


        const response =
        await fetch(
            "data/disaster_state.json?cache=" + Date.now()
        );



        const data =
        await response.json();



        const events =
        data.events || [];




        events.forEach(event=>{


            if(
                !event.coordinates
            ){

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




            let color =
            "#00ffff";



            switch(event.type){


                case "earthquake":

                    color =
                    "red";

                    break;



                case "volcano":

                    color =
                    "orange";

                    break;



                case "weather":

                    color =
                    "purple";

                    break;



                case "solar":

                    color =
                    "yellow";

                    break;


            }





            L.circleMarker(

                [
                    lat,
                    lon
                ],

                {

                    radius:10,

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
            ${event.title || "Unknown Event"}
            </b>


            <br><br>


            Type:

            ${event.type || "Unknown"}



            <br>


            Severity:

            ${event.severity || "Unknown"}



            <br>


            Location:

            ${event.location || "Unknown"}



            <br><br>


            Source:

            ${event.source || "Unknown"}



            `);



        });



    }

    catch(error){


        console.log(

            "Disaster map error:",
            error

        );


    }


}




// =============================
// START SYSTEM
// =============================


document.addEventListener(
"DOMContentLoaded",
()=>{


    loadIntelligence();


    loadDisasterMap();


});
