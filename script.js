/* =====================================================
   SITH OPERATION WEBSITE SCRIPT
   CLEAN REBUILD
===================================================== */


let disasterMap = null;
let mapInitializationInProgress = false;
let activeMapResizeHandler = null;


function refreshMapLayout(mapInstance) {

    if (!mapInstance) {

        return;

    }


    if (typeof mapInstance.invalidateSize === "function") {

        try {

            mapInstance.invalidateSize();

        }
        catch (error) {

            console.warn("Map invalidateSize failed", error);

        }

    }


    if (typeof mapInstance.resize === "function") {

        try {

            mapInstance.resize();

        }
        catch (error) {

            console.warn("Map resize failed", error);

        }

    }

}


function bindMapResizeHandler(mapInstance) {

    if (activeMapResizeHandler) {

        window.removeEventListener("resize", activeMapResizeHandler);
        window.removeEventListener("orientationchange", activeMapResizeHandler);
        document.removeEventListener("visibilitychange", activeMapResizeHandler);

    }


    activeMapResizeHandler = () => {

        requestAnimationFrame(() => {

            refreshMapLayout(mapInstance);

        });

    };


    window.addEventListener("resize", activeMapResizeHandler);
    window.addEventListener("orientationchange", activeMapResizeHandler);
    document.addEventListener("visibilitychange", activeMapResizeHandler);

}


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
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#39;"
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

    if (mapInitializationInProgress) {

        return;

    }


    mapInitializationInProgress = true;


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



    if (disasterMap) {

        disasterMap.remove();

        disasterMap = null;

    }


    mapElement.innerHTML = "";
    mapElement.style.width = "100%";
    mapElement.style.height = "100%";




    let fallbackTriggered = false;


    try {

        disasterMap = new maplibregl.Map({

            container: mapElement,

            style: {

                version: 8,


                sources: {

                    osm: {

                        type: "raster",

                        tiles: [

                            "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                            "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                            "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"

                        ],

                        tileSize: 256

                    }

                },


                layers: [

                    {

                        id: "osm",

                        type: "raster",

                        source: "osm"

                    }

                ]

            },


            center: [

                0,

                20

            ],


            zoom: 2

        });

    }
    catch (error) {

        console.warn("MapLibre failed to initialize, using Leaflet fallback", error);

        fallbackTriggered = true;

        disasterMap = null;

        await loadLeafletFallbackMap(mapElement);

        return;

    }


    disasterMap.on("error", (event) => {

        if (fallbackTriggered) {

            return;

        }

        fallbackTriggered = true;

        console.warn("MapLibre error detected, switching to Leaflet fallback", event.error);

        disasterMap.remove();

        disasterMap = null;

        loadLeafletFallbackMap(mapElement).catch(error => {

            console.error("Leaflet fallback failed", error);

        });

    });


    disasterMap.addControl(

        new maplibregl.NavigationControl()

    );


    bindMapResizeHandler(disasterMap);

    requestAnimationFrame(() => {

        refreshMapLayout(disasterMap);

    });


    const loadTimeout = setTimeout(() => {

        if (fallbackTriggered) {

            return;

        }

        if (!disasterMap || !disasterMap.loaded()) {

            fallbackTriggered = true;

            console.warn("MapLibre did not finish loading in time, switching to Leaflet fallback");

            disasterMap.remove();

            disasterMap = null;

            loadLeafletFallbackMap(mapElement).catch(error => {

                console.error("Leaflet fallback failed", error);

            });

        }

    }, 4000);





    disasterMap.on(

        "load",

        async () => {

            refreshMapLayout(disasterMap);


            console.log(
                "MapLibre loaded"
            );



            try {


                const files = [


                    "data/earthquakes.json",


                    "data/volcanoes.json",


                    "data/weather.json"


                ];



                let events = [];




                for (

                    const file of files

                ) {


                    try {


                        const response =
                            await fetch(
                                `${file}?cache=${Date.now()}`
                            );



                        if (!response.ok) {


                            console.warn(
                                `${file} unavailable`
                            );


                            continue;

                        }



                        const data =
                            await response.json();



                        if (

                            Array.isArray(data)

                        ) {


                            events =
                                events.concat(data);

                        }


                    }


                    catch (error) {


                        console.error(

                            "Failed loading",

                            file,

                            error

                        );


                    }


                }





                const geojson = {


                    type:

                        "FeatureCollection",



                    features:

                        events.map(event => {



                            /*
                                POINT EVENTS
    
                                Earthquake
                                Volcano
    
                            */


                            if (


                                event.coordinates &&


                                event.coordinates.lat !== undefined &&


                                event.coordinates.lon !== undefined


                            ) {



                                return {


                                    type:

                                        "Feature",



                                    properties: {


                                        title:

                                            event.title,



                                        location:

                                            event.location,



                                        severity:

                                            event.severity,



                                        type:

                                            event.type


                                    },



                                    geometry: {


                                        type:

                                            "Point",



                                        coordinates:

                                            [


                                                event.coordinates.lon,


                                                event.coordinates.lat


                                            ]

                                    }


                                };


                            }





                            /*
                                WEATHER POLYGONS
    
                            */


                            if (


                                event.coordinates &&


                                event.coordinates.polygon


                            ) {



                                return {


                                    type:

                                        "Feature",



                                    properties: {


                                        title:

                                            event.title,



                                        location:

                                            event.location,



                                        severity:

                                            event.severity,



                                        type:

                                            event.type


                                    },



                                    geometry: {


                                        type:

                                            "Polygon",



                                        coordinates:

                                            event.coordinates.polygon


                                    }


                                };


                            }





                            return null;



                        })


                            .filter(Boolean)


                };





                console.log(

                    "Map features loaded:",

                    geojson.features.length

                );





                disasterMap.addSource(

                    "disaster-events",

                    {


                        type:

                            "geojson",


                        data:

                            geojson


                    }

                );







                /*
                    POINT MARKERS

                */


                disasterMap.addLayer({


                    id:

                        "disaster-points",



                    type:

                        "circle",



                    source:

                        "disaster-events",



                    filter:


                        [

                            "==",

                            [

                                "geometry-type"

                            ],

                            "Point"

                        ],



                    paint:


                    {


                        "circle-radius":

                            7,



                        "circle-color":


                            [

                                "match",


                                [

                                    "get",

                                    "type"

                                ],



                                "earthquake",

                                "#ff4444",



                                "volcano",

                                "#ff9900",



                                "#00ffff"


                            ],



                        "circle-opacity":

                            0.85,



                        "circle-stroke-width":

                            2,



                        "circle-stroke-color":

                            "#ffffff"


                    }


                });







                /*
                    WEATHER WARNING AREAS

                */


                disasterMap.addLayer({


                    id:

                        "weather-polygons",



                    type:

                        "fill",



                    source:

                        "disaster-events",



                    filter:


                        [

                            "==",

                            [

                                "geometry-type"

                            ],

                            "Polygon"

                        ],



                    paint:


                    {


                        "fill-color":

                            "#9933ff",



                        "fill-opacity":

                            0.25


                    }


                });







                disasterMap.addLayer({


                    id:

                        "weather-outline",



                    type:

                        "line",



                    source:

                        "disaster-events",



                    filter:


                        [

                            "==",

                            [

                                "geometry-type"

                            ],

                            "Polygon"

                        ],



                    paint:


                    {


                        "line-color":

                            "#cc66ff",



                        "line-width":

                            2


                    }


                });







                /*
                    POINT POPUPS

                */


                disasterMap.on(

                    "click",

                    "disaster-points",

                    (event) => {


                        const props =
                            event.features[0].properties;



                        new maplibregl.Popup()


                            .setLngLat(
                                event.lngLat
                            )


                            .setHTML(`


                                <strong>

                                ${props.title}

                                </strong>


                                <br>


                                Location:

                                ${props.location}


                                <br>


                                Severity:

                                ${props.severity}


                                <br>


                                Type:

                                ${props.type}


                            `)


                            .addTo(
                                disasterMap
                            );


                    }

                );







                /*
                    WEATHER POPUPS

                */


                disasterMap.on(

                    "click",

                    "weather-polygons",

                    (event) => {


                        const props =
                            event.features[0].properties;



                        new maplibregl.Popup()


                            .setLngLat(

                                event.lngLat

                            )


                            .setHTML(`


                                <strong>

                                ${props.title}

                                </strong>


                                <br>


                                Location:

                                ${props.location}


                                <br>


                                Severity:

                                ${props.severity}


                            `)


                            .addTo(
                                disasterMap
                            );


                    }

                );







                /*
                    CURSOR

                */


                disasterMap.on(

                    "mouseenter",

                    "disaster-points",

                    () => {


                        disasterMap.getCanvas()
                            .style.cursor =
                            "pointer";


                    }

                );



                disasterMap.on(

                    "mouseenter",

                    "weather-polygons",

                    () => {


                        disasterMap.getCanvas()
                            .style.cursor =
                            "pointer";


                    }

                );



                disasterMap.on(

                    "mouseleave",

                    "disaster-points",

                    () => {


                        disasterMap.getCanvas()
                            .style.cursor =
                            "";


                    }

                );



                disasterMap.on(

                    "mouseleave",

                    "weather-polygons",

                    () => {


                        disasterMap.getCanvas()
                            .style.cursor =
                            "";


                    }

                );



            }


            catch (error) {


                console.error(

                    "Map build error:",

                    error

                );


            }




            disasterMap.resize();



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
   UFO BACK TO TOP
===================================================== */

function initUFOButton() {

    const button =
        document.getElementById("ufo-top");


    if (!button) {

        return;

    }


    button.addEventListener(
        "click",
        () => {


            button.classList.add(
                "launch"
            );


            window.scrollTo({

                top: 0,

                behavior: "smooth"

            });


            setTimeout(() => {

                button.classList.remove(
                    "launch"
                );

            }, 1000);


        }
    );

}


/* =====================================================
   SENTINEL GRID INTELLIGENCE ENGINE
===================================================== */


let sentinelMap = null;
let sentinelMapResizeHandler = null;
let sentinelEventLayer = null;
let sentinelResizeObserver = null;
let sentinelEvents = [];
let activeSentinelPublicationId = null;

const SENTINEL_DATA_ROOT = "data";
const SENTINEL_SUPPORTED_SCHEMA_MAJOR = 1;
const SENTINEL_REFRESH_INTERVAL = 5 * 60 * 1000;
const SENTINEL_INITIAL_VIEW = Object.freeze({ center: [20, 0], zoom: 2 });
const SENTINEL_RELEASE_FILES = Object.freeze([
    "health.json",
    "world_events.json",
    "map_events.json",
    "timeline.json",
    "trends.json",
    "intelligence_brief.json",
    "dashboard.json"
]);




async function loadSentinelDashboard() {


    try {


        const data =
            await fetchJSON(
                "data/dashboard.json"
            );



        document.getElementById(
            "threat-level"
        ).textContent =
            data.summary.global_threat_level;



        document.getElementById(
            "total-events"
        ).textContent =
            data.summary.total_events;



        document.getElementById(
            "critical-events"
        ).textContent =
            data.critical_events.length;



    }

    catch (error) {

        console.error(
            "Sentinel dashboard failed",
            error
        );


    }


}






async function loadSentinelBrief() {

    try {

        const data =
            await fetchJSON(
                "data/dashboard.json"
            );


        const box =
            document.getElementById(
                "intel-brief"
            );


        if (!box) {
            return;
        }


        box.innerHTML = `

        <h3>
        Critical Intelligence
        </h3>

        <p>
        Select an alert counter above to view summaries.
        </p>

        `;


    }

    catch (error) {

        console.error(
            "Brief failed",
            error
        );

    }

}








async function loadSentinelEvents() {


    try {


        const events =
            await fetchJSON(
                "data/world_events.json"
            );



        const box =
            document.getElementById(
                "sentinel-events"
            );



        box.innerHTML =


            events.slice(0, 10)

                .map(event => `


<div class="sentinel-event">


<b>
${event.title}
</b>


<br>


Type:
${event.type}


<br>


Threat:
${event.threat_level}


</div>



`).join("");



    }

    catch (error) {

        console.error(
            "Event stream failed",
            error
        );

    }



}









async function loadSentinelMap() {

    const container =
        document.getElementById("sentinel-map");


    if (!container) {
        console.error("Sentinel map container missing");
        return;
    }


    if (sentinelMap) {
        sentinelMap.remove();
    }


    sentinelMap = new maplibregl.Map({

        container: "sentinel-map",

        style: {

            version: 8,

            sources: {

                osm: {

                    type: "raster",

                    tiles: [
                        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    ],

                    tileSize: 256
                }
            },


            layers: [

                {
                    id: "osm",

                    type: "raster",

                    source: "osm"
                }

            ]
        },


        center: [
            0,
            20
        ],

        zoom: 2
    });



    sentinelMap.on("load", async () => {


        console.log("Sentinel MapLibre loaded");


        const events =
            await fetchJSON(
                "data/map_events.json"
            );


        const geojson = {

            type: "FeatureCollection",

            features:
                events.map(event => ({

                    type: "Feature",

                    properties: event,

                    geometry: {

                        type: "Point",

                        coordinates: [
                            event.longitude,
                            event.latitude
                        ]

                    }

                }))

        };


        sentinelMap.addSource(
            "sentinel-events",
            {
                type: "geojson",
                data: geojson
            }
        );



        sentinelMap.addLayer({

            id: "sentinel-events",

            type: "circle",

            source: "sentinel-events",

            paint: {

                "circle-radius": 8,

                "circle-color": [

                    "match",

                    [
                        "get",
                        "threat_level"
                    ],

                    "CRITICAL",
                    "#ff004c",

                    "HIGH",
                    "#ff8800",

                    "MEDIUM",
                    "#ffff00",

                    "#00ffff"

                ],

                "circle-stroke-width": 2,

                "circle-stroke-color": "#ffffff"

            }

        });



        sentinelMap.on(
            "click",
            "sentinel-events",
            (e) => {

                const event =
                    e.features[0].properties;


                new maplibregl.Popup()

                    .setLngLat(
                        e.lngLat
                    )

                    .setHTML(`

                    <h3>
                    ${event.title || "Sentinel Event"}
                    </h3>

                    <p>
                    ${event.description || "No description available"}
                    </p>

                    <p>
                    <b>Threat:</b>
                    ${event.threat_level || "Unknown"}
                    </p>

                    <p>
                    <b>Source:</b>
                    ${event.source || "Unknown"}
                    </p>

                    `)

                    .addTo(
                        sentinelMap
                    );

            }
        );



        sentinelMap.on(
            "mouseenter",
            "sentinel-events",
            () => {

                sentinelMap.getCanvas().style.cursor =
                    "pointer";

            }
        );


        sentinelMap.on(
            "mouseleave",
            "sentinel-events",
            () => {

                sentinelMap.getCanvas().style.cursor =
                    "";

            }
        );



        setTimeout(() => {

            sentinelMap.resize();

        }, 500);


    });


}


function plainText(value) {

    const element = document.createElement("div");

    element.innerHTML = String(value || "");

    return (element.textContent || "")
        .replace(/\s+/g, " ")
        .trim();

}


function eventSummary(event) {

    const details = event.details || {};
    const summary = event.description ||
        details.description ||
        details.message ||
        details.instruction ||
        event.location ||
        "No summary is available for this event.";

    const text = plainText(summary);

    return text.length > 360 ? `${text.slice(0, 357)}...` : text;

}


function eventPopup(event) {

    const level = event.threat_level || event.severity || event.priority || "Unknown";
    const location = event.location ?
        `<p><b>Location:</b> ${safe(event.location)}</p>` : "";

    return `
        <article class="map-popup">
            <h3>${safe(event.title || "Intelligence Event")}</h3>
            <p>${safe(eventSummary(event))}</p>
            ${location}
            <p><b>Category:</b> ${safe(event.type || "Unknown")}</p>
            <p><b>Level:</b> ${safe(level)}</p>
            <p><b>Source:</b> ${safe(event.source || "Sentinel Grid")}</p>
        </article>
    `;

}


function validCoordinate(value, limit) {

    const number = Number(value);

    return Number.isFinite(number) && Math.abs(number) <= limit;

}


function sentinelElement(id) {

    return document.getElementById(id);

}


function setSentinelStatus(message, state = "loading") {

    const status = sentinelElement("sentinel-publication-status");

    if (!status) {
        return;
    }

    status.textContent = message;
    status.className = `sentinel-status sentinel-status-${state}`;

}


function schemaMajor(value) {

    const match = String(value || "").match(/^(\d+)/);

    return match ? Number(match[1]) : null;

}


async function fetchSentinelJSON(filename, publicationId = null, noStore = false) {

    const version = publicationId ?
        `?publication=${encodeURIComponent(publicationId)}` : "";
    const response = await fetch(`${SENTINEL_DATA_ROOT}/${filename}${version}`, {
        cache: noStore ? "no-store" : "default",
        headers: { Accept: "application/json" }
    });

    if (!response.ok) {
        throw new Error(`${filename} unavailable (${response.status})`);
    }

    return response.json();

}


async function sha256Hex(bytes) {

    if (!window.crypto?.subtle) {
        throw new Error("This browser cannot verify Sentinel release integrity");
    }

    const digest = await window.crypto.subtle.digest("SHA-256", bytes);

    return Array.from(new Uint8Array(digest))
        .map(value => value.toString(16).padStart(2, "0"))
        .join("");

}


async function fetchVerifiedSentinelArtifact(filename, manifest) {

    const metadata = manifest.files?.[filename];

    if (!metadata) {
        throw new Error(`Manifest metadata is missing for ${filename}`);
    }

    const response = await fetch(
        `${SENTINEL_DATA_ROOT}/${filename}?publication=${encodeURIComponent(manifest.publication_id)}`,
        { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
        throw new Error(`${filename} unavailable (${response.status})`);
    }

    const bytes = await response.arrayBuffer();

    if (bytes.byteLength !== metadata.bytes) {
        throw new Error(`${filename} failed byte-size verification`);
    }

    const hash = await sha256Hex(bytes);
    if (hash !== metadata.sha256) {
        throw new Error(`${filename} failed SHA-256 verification`);
    }

    try {
        return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    }
    catch (error) {
        console.error(`${filename} JSON decoding failed`, error);
        throw new Error(`${filename} contains invalid UTF-8 JSON`);
    }

}


function validateSentinelArtifacts(artifacts) {

    if (!artifacts.dashboard || typeof artifacts.dashboard !== "object" ||
        !artifacts.dashboard.summary || typeof artifacts.dashboard.summary !== "object") {
        throw new Error("dashboard.json does not match the Sentinel 1.0 contract");
    }
    if (!Array.isArray(artifacts.mapEvents)) {
        throw new Error("map_events.json must be a top-level array");
    }
    if (!Array.isArray(artifacts.timeline)) {
        throw new Error("timeline.json must be a top-level array");
    }
    if (!artifacts.worldEvents || typeof artifacts.worldEvents !== "object" ||
        schemaMajor(artifacts.worldEvents.schema_version) !== SENTINEL_SUPPORTED_SCHEMA_MAJOR ||
        !Array.isArray(artifacts.worldEvents.events)) {
        throw new Error("world_events.json does not match the Sentinel 1.0 contract");
    }
    if (!artifacts.health || typeof artifacts.health !== "object" ||
        schemaMajor(artifacts.health.schema_version) !== SENTINEL_SUPPORTED_SCHEMA_MAJOR ||
        !Array.isArray(artifacts.health.sources)) {
        throw new Error("health.json does not match the Sentinel 1.0 contract");
    }

}


function normalizeSentinelEvent(event) {

    if (!event || typeof event !== "object") {
        return null;
    }

    const latitude = event.latitude ?? event.location?.latitude ?? event.coordinates?.lat;
    const longitude = event.longitude ?? event.location?.longitude ?? event.coordinates?.lon;

    if (!validCoordinate(latitude, 90) || !validCoordinate(longitude, 180)) {
        return null;
    }

    return {
        ...event,
        latitude: Number(latitude),
        longitude: Number(longitude),
        type: String(event.type || event.event_type || event.category || "unknown").toLowerCase(),
        threat_level: String(event.threat_level || event.priority || "unknown").toUpperCase()
    };

}


function updateSentinelDashboard(data) {

    const summary = data && typeof data.summary === "object" ? data.summary : {};
    const criticalEvents = Array.isArray(data?.critical_events) ? data.critical_events : [];
    const threatLevel = summary.global_threat_level || summary.threat_level || "UNKNOWN";
    const totalEvents = Number.isFinite(Number(summary.total_events)) ? summary.total_events : 0;

    const threat = sentinelElement("threat-level");
    const total = sentinelElement("total-events");
    const critical = sentinelElement("critical-events");

    if (threat) threat.textContent = String(threatLevel);
    if (total) total.textContent = String(totalEvents);
    if (critical) critical.textContent = String(criticalEvents.length);

}


function eventSourceText(event) {

    if (Array.isArray(event.source)) {
        return event.source.join(", ");
    }

    return event.source || "Sentinel Grid";

}


function appendPopupLine(container, label, value) {

    const paragraph = document.createElement("p");
    const heading = document.createElement("b");

    heading.textContent = `${label}: `;
    paragraph.append(heading, document.createTextNode(String(value || "Unknown")));
    container.appendChild(paragraph);

}


function sentinelPopup(events) {

    const article = document.createElement("article");
    article.className = "map-popup";

    const visibleEvents = events.slice(0, 5);
    const title = document.createElement("h3");
    title.textContent = events.length > 1 ?
        `${events.length} events at this location` :
        (events[0].title || "Intelligence Event");
    article.appendChild(title);

    visibleEvents.forEach((event, index) => {
        if (events.length > 1) {
            const eventTitle = document.createElement("h4");
            eventTitle.textContent = event.title || `Event ${index + 1}`;
            article.appendChild(eventTitle);
        }

        const summary = document.createElement("p");
        summary.textContent = eventSummary(event);
        article.appendChild(summary);
        appendPopupLine(article, "Category", event.type);
        appendPopupLine(article, "Threat", event.threat_level);
        appendPopupLine(article, "Source", eventSourceText(event));
    });

    if (events.length > visibleEvents.length) {
        const remaining = document.createElement("p");
        remaining.textContent = `${events.length - visibleEvents.length} additional events share this location.`;
        article.appendChild(remaining);
    }

    return article;

}


function eventColor(event) {

    return ({
        CRITICAL: "#ff004c",
        HIGH: "#ff8800",
        MEDIUM: "#ffff00",
        LOW: "#00ffff"
    })[event.threat_level] || getEventColor(event.type);

}


function groupEventsByCoordinate(events) {

    const groups = new Map();

    events.forEach(event => {
        const key = `${event.latitude.toFixed(5)},${event.longitude.toFixed(5)}`;
        const group = groups.get(key) || [];
        group.push(event);
        groups.set(key, group);
    });

    return Array.from(groups.values());

}


function activeSentinelFilters() {

    return {
        type: sentinelElement("sentinel-type-filter")?.value || "all",
        threat: sentinelElement("sentinel-threat-filter")?.value || "all"
    };

}


function renderSentinelEvents() {

    if (!sentinelMap || !sentinelEventLayer) {
        return;
    }

    sentinelEventLayer.clearLayers();

    const filters = activeSentinelFilters();
    const filtered = sentinelEvents.filter(event =>
        (filters.type === "all" || event.type === filters.type) &&
        (filters.threat === "all" || event.threat_level === filters.threat)
    );
    const groups = groupEventsByCoordinate(filtered);

    groups.forEach(events => {
        const event = events[0];
        const marker = L.circleMarker([event.latitude, event.longitude], {
            radius: Math.min(13, 7 + Math.log2(events.length)),
            color: "#ffffff",
            weight: events.length > 1 ? 2.5 : 1.5,
            fillColor: eventColor(event),
            fillOpacity: 0.88
        });

        marker.bindPopup(sentinelPopup(events), { maxWidth: 360 });
        marker.addTo(sentinelEventLayer);
    });

    const summary = sentinelElement("sentinel-map-summary");
    if (summary) {
        const overlapCount = filtered.length - groups.length;
        summary.textContent = filtered.length ?
            `Showing ${filtered.length} events at ${groups.length} mapped locations${overlapCount ? `; ${overlapCount} overlapping events are grouped` : ""}.` :
            "No mapped events match the selected filters.";
    }

}


function populateSentinelFilters(events) {

    const typeFilter = sentinelElement("sentinel-type-filter");
    const threatFilter = sentinelElement("sentinel-threat-filter");

    const populate = (select, values, format) => {
        if (!select) return;
        const previous = select.value;
        select.replaceChildren(new Option(select.id.includes("type") ? "All types" : "All levels", "all"));
        values.forEach(value => select.add(new Option(format(value), value)));
        select.value = values.includes(previous) ? previous : "all";
    };

    const types = Array.from(new Set(events.map(event => event.type))).sort();
    const threats = Array.from(new Set(events.map(event => event.threat_level))).sort((a, b) =>
        ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"].indexOf(a) -
        ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"].indexOf(b)
    );

    populate(typeFilter, types, value => value.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()));
    populate(threatFilter, threats, value => value);

}


function healthSummary(health, generated) {

    if (!health) {
        return {
            state: "degraded",
            message: generated ? `Publication generated ${formatDate(generated)}. Source health is unavailable.` : "Source health is unavailable."
        };
    }

    const sources = Array.isArray(health.sources) ? health.sources : [];
    const affectedSources = sources.filter(source => {
        const status = String(source?.status || "").toLowerCase();
        return source?.enabled !== false && status !== "ok";
    });
    const stale = Boolean(health.stale);
    const degraded = Boolean(health.degraded) || health.status === "degraded" || stale || affectedSources.length > 0;
    const timestamp = health.generated || generated;
    const affectedNames = affectedSources
        .slice(0, 3)
        .map(source => source.source)
        .filter(Boolean);
    const sourceDetail = affectedNames.length ?
        ` Affected: ${affectedNames.join(", ")}${affectedSources.length > affectedNames.length ? ` and ${affectedSources.length - affectedNames.length} more` : ""}.` : "";
    const staleDetail = stale ?
        ` Data exceeds the ${health.stale_after_minutes || 390}-minute freshness threshold.` : "";

    return {
        state: degraded ? "degraded" : "fresh",
        message: `${degraded ? "Degraded coverage." : "Coverage operational."}${staleDetail}${sourceDetail}${timestamp ? ` Health generated ${formatDate(timestamp)}.` : ""}`
    };

}


function validateManifest(manifest) {

    if (!manifest || typeof manifest !== "object" || !manifest.publication_id) {
        const error = new Error("Manifest is missing a publication ID");
        error.code = "INVALID_MANIFEST";
        throw error;
    }

    const major = schemaMajor(manifest.schema_version);
    if (major !== SENTINEL_SUPPORTED_SCHEMA_MAJOR) {
        const error = new Error(`Unsupported Sentinel schema version: ${manifest.schema_version || "unknown"}`);
        error.code = "UNSUPPORTED_SCHEMA";
        throw error;
    }

    if (!manifest.files || typeof manifest.files !== "object") {
        const error = new Error("Manifest is missing release file metadata");
        error.code = "INVALID_MANIFEST";
        throw error;
    }

    for (const filename of SENTINEL_RELEASE_FILES) {
        const metadata = manifest.files[filename];
        if (!metadata || !Number.isInteger(metadata.bytes) || metadata.bytes < 0 ||
            !/^[a-f0-9]{64}$/.test(String(metadata.sha256 || ""))) {
            const error = new Error(`Manifest metadata is invalid for ${filename}`);
            error.code = "INVALID_MANIFEST";
            throw error;
        }
    }

}


async function loadSentinelPublication() {

    let manifest;

    try {
        manifest = await fetchSentinelJSON("manifest.json", null, true);
        validateManifest(manifest);
    }
    catch (manifestError) {
        if (["INVALID_MANIFEST", "UNSUPPORTED_SCHEMA"].includes(manifestError.code)) {
            setSentinelStatus(manifestError.message, "error");
            console.error("Sentinel manifest rejected", manifestError);
            return;
        }

        if (activeSentinelPublicationId) {
            const usingLegacyData = activeSentinelPublicationId.startsWith("legacy-");
            setSentinelStatus(
                usingLegacyData ?
                    "Sentinel map is using legacy website data while publication metadata is unavailable." :
                    "Unable to check for a new publication. The last valid map remains available.",
                usingLegacyData ? "degraded" : "error"
            );
            console.warn("Sentinel manifest refresh failed", manifestError);
            return;
        }

        console.warn("Sentinel manifest unavailable; using legacy website data", manifestError);
        const [dashboard, mapEvents] = await Promise.all([
            fetchSentinelJSON("dashboard.json"),
            fetchSentinelJSON("map_events.json")
        ]);
        let health = null;
        try {
            health = await fetchSentinelJSON("health.json");
        }
        catch (healthError) {
            console.warn("Sentinel health unavailable", healthError);
        }

        manifest = {
            publication_id: `legacy-${dashboard.generated || "current"}`,
            generated: dashboard.generated,
            legacy: true
        };
        applySentinelPublication(manifest, dashboard, mapEvents, health);
        return;
    }

    if (manifest.publication_id === activeSentinelPublicationId) {
        return;
    }

    setSentinelStatus("Loading a new Sentinel Grid publication...", "loading");

    const releaseEntries = await Promise.all(
        SENTINEL_RELEASE_FILES.map(async filename => [
            filename,
            await fetchVerifiedSentinelArtifact(filename, manifest)
        ])
    );
    const release = Object.fromEntries(releaseEntries);
    const artifacts = {
        health: release["health.json"],
        worldEvents: release["world_events.json"],
        mapEvents: release["map_events.json"],
        timeline: release["timeline.json"],
        trends: release["trends.json"],
        intelligenceBrief: release["intelligence_brief.json"],
        dashboard: release["dashboard.json"]
    };

    validateSentinelArtifacts(artifacts);
    applySentinelPublication(manifest, artifacts.dashboard, artifacts.mapEvents, artifacts.health);

}


function applySentinelPublication(manifest, dashboard, mapEvents, health) {

    if (!dashboard || typeof dashboard !== "object") {
        throw new Error("Invalid dashboard data");
    }
    if (!Array.isArray(mapEvents)) {
        throw new Error("Invalid map event data");
    }

    const normalizedEvents = mapEvents.map(normalizeSentinelEvent).filter(Boolean);

    updateSentinelDashboard(dashboard);
    sentinelEvents = normalizedEvents;
    activeSentinelPublicationId = manifest.publication_id;
    populateSentinelFilters(sentinelEvents);
    renderSentinelEvents();

    const status = healthSummary(health, manifest.generated || dashboard.generated);
    if (manifest.legacy) {
        setSentinelStatus(`${status.message} Awaiting manifest-based publication metadata.`, "degraded");
    }
    else {
        setSentinelStatus(status.message, status.state);
    }

}


function resizeSentinelMap() {

    if (!sentinelMap) return;

    const container = sentinelElement("sentinel-map");
    if (!container || container.clientWidth === 0 || container.clientHeight === 0 || document.visibilityState === "hidden") {
        return;
    }

    requestAnimationFrame(() => sentinelMap.invalidateSize({ pan: false, animate: false }));

}


function initializeSentinelMap() {

    const container = sentinelElement("sentinel-map");

    if (!container || typeof L === "undefined") {
        throw new Error("Leaflet or the Sentinel map container is unavailable");
    }

    sentinelMap = L.map(container, {
        center: SENTINEL_INITIAL_VIEW.center,
        zoom: SENTINEL_INITIAL_VIEW.zoom,
        minZoom: 2,
        worldCopyJump: true,
        preferCanvas: true,
        zoomAnimation: false,
        fadeAnimation: false
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap contributors",
        updateWhenZooming: false,
        keepBuffer: 3
    }).addTo(sentinelMap);

    sentinelEventLayer = L.layerGroup().addTo(sentinelMap);

    if (typeof ResizeObserver !== "undefined") {
        sentinelResizeObserver = new ResizeObserver(resizeSentinelMap);
        sentinelResizeObserver.observe(container);
    }

    window.addEventListener("resize", resizeSentinelMap, { passive: true });
    window.addEventListener("orientationchange", resizeSentinelMap, { passive: true });
    window.addEventListener("pageshow", resizeSentinelMap, { passive: true });
    window.visualViewport?.addEventListener("resize", resizeSentinelMap, { passive: true });
    document.addEventListener("visibilitychange", resizeSentinelMap);

    sentinelElement("sentinel-type-filter")?.addEventListener("change", renderSentinelEvents);
    sentinelElement("sentinel-threat-filter")?.addEventListener("change", renderSentinelEvents);
    sentinelElement("sentinel-reset-map")?.addEventListener("click", () => {
        sentinelMap.setView(SENTINEL_INITIAL_VIEW.center, SENTINEL_INITIAL_VIEW.zoom);
    });

    resizeSentinelMap();
    setTimeout(resizeSentinelMap, 350);
    setTimeout(resizeSentinelMap, 1200);

}


async function initializeSentinel() {

    try {
        initializeSentinelMap();
        await loadSentinelPublication();
    }
    catch (error) {
        console.error("Sentinel initialization failed", error);
        setSentinelStatus("Sentinel data is temporarily unavailable. Please try again later.", "error");
        const summary = sentinelElement("sentinel-map-summary");
        if (summary) summary.textContent = "The map is available, but event data could not be loaded.";
    }

    window.setInterval(() => {
        if (document.visibilityState !== "hidden") {
            loadSentinelPublication().catch(error => {
                console.error("Sentinel refresh failed", error);
                setSentinelStatus("A refresh failed. The last valid map remains available.", "error");
            });
        }
    }, SENTINEL_REFRESH_INTERVAL);

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            loadSentinelPublication().catch(error => console.error("Sentinel visibility refresh failed", error));
        }
    });

}



/* =====================================================
   APPLICATION START
===================================================== */


document.addEventListener(

    "DOMContentLoaded",

    () => {


        try {

            startTypewriter();

        }

        catch (error) {

            console.error(
                "Typewriter failed:",
                error
            );

        }



        try {

            preloadBackgrounds();

            initBackground();

            setInterval(
                rotateBackground,
                6000
            );

        }

        catch (error) {

            console.error(
                "Background failed:",
                error
            );

        }


        try {

            loadIntelligence();

        }

        catch (error) {

            console.error(
                "Intelligence failed:",
                error
            );

        }


        try {

            initProjectCards();

        }

        catch (error) {

            console.error(
                "Projects failed:",
                error
            );

        }



        try {

            initUFOButton();

        }

        catch (error) {

            console.error(
                "UFO failed:",
                error
            );

        }


    }

);


