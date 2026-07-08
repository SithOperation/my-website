// =====================
// TYPEWRITER
// =====================

const text = "system online...";
let i = 0;

function type() {
    const el = document.getElementById("typing");
    if (!el) return;

    if (i === 0) el.innerHTML = "";

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
// PROJECT VIEWER (FIXED)
// =====================

function loadProject(key) {
    const viewer = document.getElementById("viewer-content");
    const project = projects[key];

    if (!viewer || !project) return;

    let html = `<h2>${project.title}</h2>`;

    // IMAGES
    if (project.images && project.images.length > 0) {
        html += `<h3>Evidence</h3>`;
        project.images.forEach(img => {
            html += `<img src="${img}">`;
        });
    }

    // PDF
    if (project.pdf) {
        html += `
            <h3>Report</h3>
            <iframe src="${project.pdf}"></iframe>
            <a href="${project.pdf}" target="_blank" class="project">
                Open Full PDF
            </a>
        `;
    }

    viewer.innerHTML = html;

    viewer.scrollIntoView({ behavior: "smooth", block: "center" });
}


// =====================
// BACKGROUND GIF SYSTEM (STABLE VERSION)
// =====================

const gifs = [
    "assets/i-made-some-gifs-v0-9yugvn57e5o81.gif",
    "assets/i-made-some-gifs-v0-fphci857e5o81.gif",
    "assets/i-made-some-gifs-v0-uhn1le67e5o81.gif",
    "assets/i-made-some-gifs-v0-vv91pq57e5o81.gif"
];

// preload
gifs.forEach(src => {
    const img = new Image();
    img.src = src;
});

let index = 0;

const bg1 = document.getElementById("bg1");
const bg2 = document.getElementById("bg2");
const bg3 = document.getElementById("bg3");

function initBackground() {
    if (!bg1 || !bg2 || !bg3) return;

    bg1.style.backgroundImage = `url('${gifs[0]}')`;
    bg2.style.backgroundImage = `url('${gifs[1]}')`;
    bg3.style.backgroundImage = `url('${gifs[2]}')`;

    bg1.style.opacity = "1";
    bg2.style.opacity = "0";
    bg3.style.opacity = "0";
}

function rotateBackground() {
    if (!bg1 || !bg2 || !bg3) return;

    index = (index + 1) % gifs.length;

    const next = gifs[index];

    // shift visuals DOWN the pipeline (NOT array swapping)
    bg1.style.backgroundImage = bg2.style.backgroundImage;
    bg2.style.backgroundImage = bg3.style.backgroundImage;
    bg3.style.backgroundImage = `url('${next}')`;

    // fade control (stable)
    bg3.style.opacity = "1";
    bg2.style.opacity = "0.6";
    bg1.style.opacity = "0.2";

    setTimeout(() => {
        bg1.style.backgroundImage = bg2.style.backgroundImage;
        bg2.style.opacity = "0";
        bg1.style.opacity = "1";
    }, 1500);
}

// init
initBackground();
setInterval(rotateBackground, 6000);

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


    try{


        const response =
        await fetch(
            "data/disaster_state.json"
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
                name:"🌎 EARTHQUAKES",
                key:"earthquakes"
            },

            {
                name:"🌋 VOLCANOES",
                key:"volcanoes"
            },

            {
                name:"☀️ SOLAR",
                key:"solar"
            },

            {
                name:"⛈ WEATHER",
                key:"weather"
            }

        ];




        categories.forEach(category=>{


            html += `

            <div class="intel-item">

            <b>
            ${category.name}
            </b>

            <br><br>

            `;



            const events =
            history[category.key] || [];



            if(events.length === 0){


                html +=
                "No recent events";


            }

            else {


                events
                .slice(0,2)
                .forEach(event=>{


                    html += `

                    <hr>

                    <b>
                    ${event.title}
                    </b>

                    <br>

                    Location:
                    ${event.location || "Unknown"}

                    <br>

                    Severity:
                    ${event.severity || "Unknown"}

                    <br>

                    Time:
                    ${event.time || "Unknown"}

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

    }

}



// =============================
// EWS INTELLIGENCE
// =============================

async function loadEWS(){

    const feed = document.getElementById(
        "ews-feed"
    );


    try{

        const response = await fetch(
            "data/ews_state.json"
        );


        const data = await response.json();



        feed.innerHTML = `


        <div class="intel-status status-online">
        ● EWS MONITOR ONLINE
        </div>


        <div class="intel-item">

        ✈️ EARLY WARNING SYSTEM


        <br><br>


        <b>Status Level:</b>

        ${data.level ?? "N/A"}/5


        <br>


        <b>Tracked Aircraft:</b>

        ${data.concurrent_count ?? "N/A"}


        <br>


        <b>Anomaly Score:</b>

        ${
            data.z_score
            ?
            data.z_score.toFixed(2)
            :
            "N/A"
        }σ


        <br>


        <b>Updated:</b>

        ${data.as_of ?? "Unknown"}


        </div>


        `;


    }
    catch(error){


        feed.innerHTML = `

        <div class="status-alert">

        ● EWS FEED OFFLINE

        </div>

        `;


        console.log(
            "EWS error:",
            error
        );


    }

}







// =============================
// AI CYBER DIGEST
// =============================

async function loadAINews(){

    const feed = document.getElementById(
        "ai-news-feed"
    );


    try {

        const response = await fetch(
            "output/latest_digest.md?cache=" + Date.now()
        );


        const markdown = await response.text();


        if (!response.ok) {
            throw new Error("Digest unavailable");
        }


        const lines = markdown.split("\n");


        let html = `

        <div class="intel-status status-online">
        ● AI CYBER DIGEST ONLINE
        </div>

        `;


        let count = 0;


        lines.forEach(line => {


            if (
                line.startsWith("## ")
                &&
                count < 5
            ){

                count++;


                html += `

                <div class="intel-item">

                🤖 INTEL REPORT #${count}

                <br><br>

                <b>
                ${line.replace("## ","")}
                </b>

                <br><br>

                Loading analyst summary...

                </div>

                `;

            }


        });



        html += `

        <p>
        Last Updated:
        ${new Date().toUTCString()}
        </p>

        `;


        feed.innerHTML = html;



    }

    catch(error){


        feed.innerHTML = `

        <div class="status-alert">

        ● AI INTELLIGENCE OFFLINE

        </div>

        `;


        console.log(
            "AI digest error:",
            error
        );

    }

}


// =============================
// GLOBAL DISASTER MAP
// =============================

let disasterMap;



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
            "© OpenStreetMap"

        }

    ).addTo(
        disasterMap
    );



    try{


        const response =
        await fetch(
            "data/disaster_state.json"
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
            event.coordinates.lat;



            const lon =
            event.coordinates.lon;



            if(
                lat === 0 ||
                lon === 0
            ){

                return;

            }



            let iconColor =
            "blue";



            if(event.type === "earthquake"){

                iconColor="red";

            }


            if(event.type === "volcano"){

                iconColor="orange";

            }


            if(event.type === "weather"){

                iconColor="purple";

            }


            if(event.type === "solar"){

                iconColor="yellow";

            }




            L.circleMarker(

                [
                    lat,
                    lon
                ],

                {

                radius:10,

                fillOpacity:.8

                }

            )

            .addTo(
                disasterMap
            )


            .bindPopup(`

            <b>
            ${event.title}
            </b>

            <br><br>


            Type:
            ${event.type}


            <br>


            Severity:
            ${event.severity}


            <br>


            Location:
            ${event.location}


            <br><br>


            Source:
            ${event.source}

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

loadIntelligence();

loadDisasterMap();
