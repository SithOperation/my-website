const text = "system online...";
let typeIndex = 0;


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

            element.innerHTML += 
            '<span class="cursor">█</span>';

        }

    }


    type();

}





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
            "Project not found:",
            key
        );

        return;

    }



    let html = `

    <h2>
    ${project.title}
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



const bg1 = document.getElementById("bg1");
const bg2 = document.getElementById("bg2");
const bg3 = document.getElementById("bg3");




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



    const next =
    gifs[backgroundIndex];



    const current =
    bg2.style.backgroundImage;



    bg1.style.backgroundImage =
    current;



    bg2.style.backgroundImage =
    bg3.style.backgroundImage;



    bg3.style.backgroundImage =
    `url("${next}")`;



    bg3.style.opacity="1";

    bg2.style.opacity=".6";

    bg1.style.opacity=".25";



    setTimeout(()=>{


        bg1.style.backgroundImage =
        bg3.style.backgroundImage;


        bg1.style.opacity="1";

        bg2.style.opacity="0";


    },1500);


}





initBackground();



setInterval(
rotateBackground,
6000
);







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

    if(!value){

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







async function loadIntelligence(){


    loadDisasterIntelligence();

    loadEWS();

    loadAINews();


}








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
                name:"☀️ SOLAR ACTIVITY",
                key:"solar"
            },

            {
                name:"⛈ WEATHER",
                key:"weather"
            }

        ];



        let html = `

        <div class="intel-status">

        ● DISASTER INTELLIGENCE ONLINE

        </div>

        `;



        categories.forEach(category=>{


            html += `

            <div class="intel-item">

            <h3>
            ${category.name}
            </h3>

            `;



            const events =
            history[category.key] || [];



            if(!events.length){

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

                    `;


                });


            }



            html += `

            </div>

            `;


        });



        feed.innerHTML = html;


    }
    catch(error){


        console.log(
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


        ✈️ EARLY WARNING SYSTEM


        <br><br>


        <b>Status Level:</b>

        ${safe(data.level)}/5


        <br>


        <b>Tracked Aircraft:</b>

        ${safe(data.concurrent_count)}


        <br>


        <b>Anomaly Score:</b>

        ${
            data.z_score !== undefined
            ?
            Number(data.z_score).toFixed(2)
            :
            "N/A"
        }σ


        <br>


        <b>Updated:</b>

        ${safe(data.as_of)}


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
            "output/latest_digest.md?cache=" +
            Date.now()
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

        <div class="intel-status">

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



            const source =
            content.match(
                /\*\*Source:\*\*\s*(.*)/
            );



            const impact =
            content.match(
                /\*\*Security Impact:\*\*\s*([\s\S]*?)\n\nLink/
            );



            const link =
            content.match(
                /Link:\s*(.*)/
            );



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



            html += `

            <div class="intel-item">


            🤖 INTEL REPORT #${index + 1}


            <br><br>


            <b>
            ${safe(title)}
            </b>


            <br><br>


            <b>Source:</b>

            ${
                source
                ?
                safe(source[1])
                :
                "Unknown"
            }


            <br><br>


            <b>
            Analyst Summary:
            </b>


            <br>

            ${safe(summary)}


            <br><br>


            <b>
            Security Impact:
            </b>


            <br>

            ${
                impact
                ?
                safe(impact[1])
                :
                "No impact analysis available"
            }


            <br><br>


            <a
            href="${
                link
                ?
                link[1]
                :
                "#"
            }"
            target="_blank">

            Read Full Report

            </a>


            </div>

            `;


        });



        feed.innerHTML = html;


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








let disasterMap = null;




async function loadDisasterMap(){


    const map =
    document.getElementById(
        "disaster-map"
    );



    if(!map){

        return;

    }



    if(typeof L === "undefined"){

        console.log(
            "Leaflet unavailable"
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
    .addTo(
        disasterMap
    );



    try{


        const data =
        await fetchJSON(
            "data/disaster_state.json"
        );



        const events =
        data.events || [];



        events.forEach(event=>{


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



            let color =
            "#00ffff";



            if(event.type==="earthquake")
                color="red";


            if(event.type==="volcano")
                color="orange";


            if(event.type==="weather")
                color="purple";


            if(event.type==="solar")
                color="yellow";




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
    catch(error){


        console.log(
            "Map error:",
            error
        );


    }


}








document.addEventListener(
"DOMContentLoaded",
()=>{


    startTypewriter();


    loadIntelligence();


    loadDisasterMap();


});
