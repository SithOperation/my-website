/* =====================================================
   SITH OPERATION WEBSITE SCRIPT
   CLEAN REBUILD
===================================================== */


let disasterMap = null;


/* =====================================================
   TYPEWRITER
===================================================== */


const typeText = "system online...";
let typeIndex = 0;


function startTypewriter() {

    const element = document.getElementById("typing");


    if (!element) {
        return;
    }


    element.innerHTML = "";

    typeIndex = 0;


    function type() {

        if (typeIndex < typeText.length) {

            element.innerHTML +=
                typeText.charAt(typeIndex);


            typeIndex++;


            setTimeout(
                type,
                80
            );

        }
        else {

            element.innerHTML +=
                '<span class="cursor">█</span>';

        }

    }


    type();

}





/* =====================================================
   PROJECT SYSTEM
===================================================== */


const projects = {


    reddit: {

        title:
            "Reddit Threat Monitor",


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

        title:
            "Healthcare Ransomware Defense",


        images: [],


        pdf:
            "assets/projects/project2.pdf"

    },



    nestle: {

        title:
            "Nestle CIA Threat Table",


        images: [],


        pdf:
            "assets/projects/project1.pdf"

    }


};





function loadProject(key) {


    const viewer =
        document.getElementById(
            "viewer-content"
        );


    const project =
        projects[key];



    if (!viewer || !project) {

        console.error(
            "Project missing:",
            key
        );

        return;

    }



    let html = `

    <h2>
        ${safe(project.title)}
    </h2>

    `;



    if (project.images.length) {


        html += `

        <h3>
            Evidence
        </h3>

        `;



        project.images.forEach(image => {


            html += `

            <img
            src="${image}"
            alt="Project Evidence">

            `;


        });


    }




    if (project.pdf) {


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

        Open Full PDF →

        </a>


        `;


    }



    viewer.innerHTML = html;



    viewer.scrollIntoView({

        behavior: "smooth",

        block: "center"

    });


}




window.loadProject = loadProject;






/* =====================================================
   BACKGROUND ROTATION
===================================================== */


const backgrounds = [


    "assets/i-made-some-gifs-v0-9yugvn57e5o81.gif",

    "assets/i-made-some-gifs-v0-fphci857e5o81.gif",

    "assets/i-made-some-gifs-v0-uhn1le67e5o81.gif",

    "assets/i-made-some-gifs-v0-vv91pq57e5o81.gif"


];



let backgroundIndex = 0;



function preloadBackgrounds() {


    backgrounds.forEach(src => {

        const img =
            new Image();

        img.src = src;

    });


}




function initBackground() {


    const bg1 =
        document.getElementById("bg1");


    const bg2 =
        document.getElementById("bg2");


    const bg3 =
        document.getElementById("bg3");



    if (!bg1 || !bg2 || !bg3) {

        return;

    }



    bg1.style.backgroundImage =
        `url("${backgrounds[0]}")`;


    bg2.style.backgroundImage =
        `url("${backgrounds[1]}")`;


    bg3.style.backgroundImage =
        `url("${backgrounds[2]}")`;


    bg1.style.opacity = "1";


    bg2.style.opacity = "0";


    bg3.style.opacity = "0";


}





function rotateBackground() {


    const bg1 =
        document.getElementById("bg1");


    const bg3 =
        document.getElementById("bg3");



    if (!bg1 || !bg3) {

        return;

    }



    backgroundIndex =
        (
            backgroundIndex + 1
        )
        %
        backgrounds.length;



    bg3.style.backgroundImage =

        `url("${backgrounds[backgroundIndex]}")`;



    bg3.style.opacity = "1";



    setTimeout(() => {


        bg1.style.backgroundImage =
            bg3.style.backgroundImage;


        bg1.style.opacity = "1";


        bg3.style.opacity = "0";


    }, 1500);


}

/* =====================================================
   HELPERS
===================================================== */


async function fetchJSON(path) {

    const response =
        await fetch(
            `${path}?cache=${Date.now()}`
        );


    if (!response.ok) {

        throw new Error(
            `${path} unavailable`
        );

    }


    return await response.json();

}





function safe(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

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





function formatDate(value) {

    if (!value) {

        return "Unknown";

    }


    const date =
        new Date(value);



    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return safe(value);

    }


    return date.toLocaleString();

}







/* =====================================================
   INTELLIGENCE LOADER
===================================================== */


function loadIntelligence() {

    loadDisasterIntelligence();

    loadEWS();

    loadAINews();

}





/* =====================================================
   DISASTER FEED
===================================================== */


async function loadDisasterIntelligence() {


    const feed =
        document.getElementById(
            "disaster-feed"
        );


    if (!feed) {

        return;

    }



    try {


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
                ([category, events]) => {


                    if (!Array.isArray(events)) {

                        return;

                    }



                    html += `

            <div class="intel-item">

            <h3>
            ${safe(category.toUpperCase())}
            </h3>

            `;



                    events
                        .slice(0, 3)
                        .forEach(event => {


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



                    html += `

            </div>

            `;


                });



        feed.innerHTML = html;



    }
    catch (error) {


        console.error(
            "Disaster feed:",
            error
        );


        feed.innerHTML = `

        <div class="status-alert">

        ● DISASTER INTELLIGENCE OFFLINE

        </div>

        `;

    }

}







/* =====================================================
   EARLY WARNING SYSTEM
===================================================== */


async function loadEWS() {


    const feed =
        document.getElementById(
            "ews-feed"
        );


    if (!feed) {

        return;

    }



    try {


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


        </div>


        `;



    }
    catch (error) {


        console.error(
            "EWS:",
            error
        );


        feed.innerHTML = `

        <div class="status-alert">

        ● EWS FEED OFFLINE

        </div>

        `;

    }

}








/* =====================================================
   AI CYBER DIGEST
===================================================== */


async function loadAINews() {


    const feed =
        document.getElementById(
            "ai-news-feed"
        );


    if (!feed) {

        return;

    }



    try {


        const data =
            await fetchJSON(
                "data/ai_cyber_digest.json"
            );



        let html = `

        <div class="intel-status">

        ● AI CYBER DIGEST ONLINE

        </div>

        `;



        if (
            Array.isArray(data.stories)
            &&
            data.stories.length
        ) {


            data.stories
                .slice(0, 5)
                .forEach((story, index) => {


                    html += `


                <div class="intel-item">


                <h3>

                ${index + 1}.
                ${safe(story.title)}

                </h3>



                <b>
                Source:
                </b>

                ${safe(story.source)}


                <br><br>


                ${safe(story.summary)}


                <br><br>


                <b>
                Score:
                </b>

                ${safe(story.score)}



                <br><br>


                <a

                href="${safe(story.link)}"

                target="_blank"

                rel="noopener noreferrer"

                class="project-link">

                Read Report →

                </a>



                </div>


                `;


                });


        }
        else {


            html += `

            <div class="intel-item">

            No reports available.

            </div>

            `;

        }



        feed.innerHTML = html;



    }
    catch (error) {


        console.error(
            "AI Digest:",
            error
        );


        feed.innerHTML = `

        <div class="status-alert">

        ● AI INTELLIGENCE OFFLINE

        </div>

        `;


    }


}







/* =====================================================
   MAPLIBRE MAP HELPERS
===================================================== */


function getEventColor(type) {

    switch (type) {

        case "earthquake":
            return "#ff4444";

        case "volcano":
            return "#ff9900";

        case "weather":
            return "#9933ff";

        case "solar":
            return "#ffff00";

        default:
            return "#00ffff";

    }

}



/* =====================================================
   DISASTER MAP (MapLibre)
===================================================== */


async function loadDisasterMap() {

    const mapElement =
        document.getElementById(
            "disaster-map"
        );

    if (!mapElement) {

        console.error(
            "Map container missing"
        );

        return;

    }

    if (typeof maplibregl === "undefined") {

        console.error(
            "MapLibre not loaded"
        );

        return;

    }

    /* Remove old map safely */
    if (disasterMap) {

        disasterMap.remove();

        disasterMap = null;

    }

    /* Create MapLibre map */
    disasterMap = new maplibregl.Map({

        container: "disaster-map",

        style: "https://demotiles.maplibre.org/style.json",

        center: [0, 20],

        zoom: 2,

        minZoom: 1,

        maxZoom: 18,

    });

    /* Handle map load event */
    disasterMap.on("load", async () => {

        try {

            const data =
                await fetchJSON(
                    "data/disaster_state.json"
                );

            const history =
                data.history || {};

            let events = [];

            Object.values(history)

                .forEach(category => {

                    if (Array.isArray(category)) {

                        events =
                            events.concat(category);

                    }

                });

            /* Build GeoJSON from events */
            const geojson = {

                type: "FeatureCollection",

                features: events.map(event => ({

                    type: "Feature",

                    properties: {

                        title: safe(event.title),

                        location: safe(event.location),

                        severity: safe(event.severity),

                        type: event.type || "default",

                    },

                    geometry: (() => {

                        if (
                            event.coordinates &&
                            event.coordinates.lat !== undefined &&
                            (event.coordinates.lon !== undefined ||
                            event.coordinates.lng !== undefined)
                        ) {

                            return {

                                type: "Point",

                                coordinates: [

                                    event.coordinates.lon ?? event.coordinates.lng,

                                    event.coordinates.lat,

                                ],

                            };

                        }

                        if (
                            event.coordinates &&
                            Array.isArray(event.coordinates.polygon)
                        ) {

                            return {

                                type: "Polygon",

                                coordinates: [event.coordinates.polygon],

                            };

                        }

                        return null;

                    })(),

                })).filter(f => f.geometry !== null),

            };

            /* Add source */
            disasterMap.addSource("disasters", {

                type: "geojson",

                data: geojson,

            });

            /* Add point layer */
            disasterMap.addLayer({

                id: "disaster-points",

                type: "circle",

                source: "disasters",

                filter: ["==", ["geometry-type"], "Point"],

                paint: {

                    "circle-radius": 6,

                    "circle-color": ["get", "type", ["literal", {

                        "earthquake": "#ff4444",

                        "volcano": "#ff9900",

                        "weather": "#9933ff",

                        "solar": "#ffff00",

                        "default": "#00ffff",

                    }]],

                    "circle-opacity": 0.8,

                    "circle-stroke-width": 2,

                    "circle-stroke-color": "#fff",

                },

            });

            /* Add polygon layer */
            disasterMap.addLayer({

                id: "disaster-polygons",

                type: "fill",

                source: "disasters",

                filter: ["==", ["geometry-type"], "Polygon"],

                paint: {

                    "fill-color": getEventColor("weather"),

                    "fill-opacity": 0.25,

                },

            });

            /* Add polygon outlines */
            disasterMap.addLayer({

                id: "disaster-polygon-outlines",

                type: "line",

                source: "disasters",

                filter: ["==", ["geometry-type"], "Polygon"],

                paint: {

                    "line-color": getEventColor("weather"),

                    "line-width": 2,

                },

            });

            /* Handle clicks for popups */
            disasterMap.on("click", "disaster-points", (e) => {

                const props = e.features[0].properties;

                const popup = new maplibregl.Popup()

                    .setLngLat(e.lngLat)

                    .setHTML(`

                        <strong>${props.title}</strong><br>
                        Location: ${props.location}<br>
                        Severity: ${props.severity}<br>
                        Type: ${props.type}

                    `)

                    .addTo(disasterMap);

            });

            disasterMap.on("click", "disaster-polygons", (e) => {

                const props = e.features[0].properties;

                const popup = new maplibregl.Popup()

                    .setLngLat(e.lngLat)

                    .setHTML(`

                        <strong>${props.title}</strong><br>
                        ${props.location}

                    `)

                    .addTo(disasterMap);

            });

            /* Change cursor on hover */
            disasterMap.on("mouseenter", "disaster-points", () => {

                disasterMap.getCanvas().style.cursor = "pointer";

            });

            disasterMap.on("mouseleave", "disaster-points", () => {

                disasterMap.getCanvas().style.cursor = "";

            });

        }
        catch (error) {

            console.error(
                "Map data error:",
                error
            );

        }

    });

}



function initUFOButton() {


    const ufoButton =
        document.getElementById(
            "ufo-top"
        );



    if (!ufoButton) {

        return;

    }




    ufoButton.addEventListener(

        "click",

        () => {


            ufoButton.classList.add(
                "launch"
            );



            window.scrollTo({

                top: 0,

                behavior: "smooth"

            });




            setTimeout(() => {


                ufoButton.classList.remove(
                    "launch"
                );


            }, 1000);



        }

    );


}









/* =====================================================
   PROJECT CLICK HANDLERS
===================================================== */


function initProjectCards() {


    document

        .querySelectorAll(
            "[data-project]"
        )

        .forEach(card => {


            card.addEventListener(

                "click",

                () => {


                    loadProject(
                        card.dataset.project
                    );


                }

            );


        });


}









/* =====================================================
   APPLICATION START
===================================================== */


document.addEventListener(

    "DOMContentLoaded",

    () => {


        startTypewriter();



        preloadBackgrounds();


        initBackground();



        setInterval(

            rotateBackground,

            6000

        );



        loadIntelligence();



        initProjectCards();



        initUFOButton();




        /*
           Wait for MapLibre rendering
        */

        setTimeout(() => {

            loadDisasterMap();

            /* Trigger map resize after load */
            setTimeout(() => {

                if (disasterMap) {

                    disasterMap.resize();

                }

            }, 1000);

        }, 1500);



    });
