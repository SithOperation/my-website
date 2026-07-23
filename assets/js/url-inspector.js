export const WORKER_BASE_URL = "https://sentinel-url-inspector.great-gs.workers.dev";
const WORKER_ENDPOINT = `${WORKER_BASE_URL}/api/url-check`;
const MAX_URL_LENGTH = 2048;
const KNOWN_THREAT_TYPES = new Set([
    "MALWARE",
    "SOCIAL_ENGINEERING",
    "UNWANTED_SOFTWARE",
    "POTENTIALLY_HARMFUL_APPLICATION"
]);
const REDIRECT_PARAMETERS = new Set([
    "continue", "dest", "destination", "go", "next", "redirect", "redirect_to",
    "redirect_uri", "return", "return_to", "returnurl", "target", "url"
]);
const EXECUTABLE_EXTENSIONS = /\.(?:apk|bat|cmd|com|cpl|dll|dmg|exe|hta|jar|js|jse|msi|ps1|scr|vbs|vbe|wsf)$/iu;

export class InputValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "InputValidationError";
    }
}

export function parseInspectorUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
        throw new InputValidationError("Enter a URL to analyze.");
    }
    if (value.length > MAX_URL_LENGTH) {
        throw new InputValidationError("The URL exceeds the 2,048 character limit.");
    }
    if (!/^https?:\/\//iu.test(value)) {
        throw new InputValidationError("Include http:// or https:// at the beginning of the URL.");
    }
    let parsed;
    try {
        parsed = new URL(value);
    }
    catch {
        throw new InputValidationError("Enter a valid, complete URL.");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new InputValidationError("Only http:// and https:// URLs can be analyzed.");
    }
    if (!parsed.hostname) {
        throw new InputValidationError("The URL must include a hostname.");
    }
    return parsed;
}

function finding(level, title, explanation) {
    return { level, title, explanation };
}

export function isIpHostname(hostname) {
    const host = String(hostname || "").replace(/^\[|\]$/gu, "");
    if (host.includes(":")) return /^[0-9a-f:.]+$/iu.test(host);
    const parts = host.split(".");
    return parts.length === 4 && parts.every(part => /^\d{1,3}$/u.test(part) && Number(part) <= 255);
}

export function analyzeUrlStructure(input) {
    const parsed = parseInspectorUrl(input);
    const normalized = new URL(parsed.href);
    const fragmentPresent = Boolean(normalized.hash);
    normalized.hash = "";
    const hostname = parsed.hostname.replace(/^\[|\]$/gu, "");
    const queryEntries = Array.from(parsed.searchParams.entries());
    const rawWithoutScheme = input.slice(input.indexOf("://") + 3);
    const percentEncodingCount = (input.match(/%[0-9a-f]{2}/giu) || []).length;
    const hostnameLabels = hostname.split(".").filter(Boolean);
    const redirectParameters = Array.from(new Set(
        queryEntries
            .map(([name]) => name.toLowerCase())
            .filter(name => REDIRECT_PARAMETERS.has(name))
    ));
    const hasUnicode = /[^\u0000-\u007f]/u.test(input);
    const hasPunycode = hostnameLabels.some(label => label.toLowerCase().startsWith("xn--"));
    const nonDefaultPort = Boolean(parsed.port) &&
        !((parsed.protocol === "https:" && parsed.port === "443") ||
          (parsed.protocol === "http:" && parsed.port === "80"));
    const findings = [
        finding(
            "Informational",
            parsed.protocol === "https:" ? "HTTPS is used" : "HTTP is used",
            parsed.protocol === "https:"
                ? "The URL declares HTTPS transport. This does not establish that its content is trustworthy."
                : "The URL declares unencrypted HTTP transport."
        )
    ];

    if (isIpHostname(hostname)) {
        findings.push(finding("Caution", "IP-address hostname", "The URL uses an IP address rather than a named host. This is a structural observation, not proof of abuse."));
    }
    if (hasPunycode) {
        findings.push(finding("Caution", "Punycode hostname", "The hostname contains an internationalized-domain encoding label. Legitimate internationalized domains may also use this format."));
    }
    if (hasUnicode) {
        findings.push(finding("Caution", "Unicode characters present", "The submitted URL contains non-ASCII characters. Review visually similar characters carefully."));
    }
    if (hostnameLabels.length > 5) {
        findings.push(finding("Caution", "Deep subdomain structure", `The hostname contains ${hostnameLabels.length} labels.`));
    }
    if (hostname.length > 100) {
        findings.push(finding("Elevated", "Unusually long hostname", `The hostname is ${hostname.length} characters long.`));
    }
    if (parsed.pathname.length > 120) {
        findings.push(finding("Caution", "Unusually long path", `The path is ${parsed.pathname.length} characters long.`));
    }
    if (nonDefaultPort) {
        findings.push(finding("Caution", "Non-default port", `The URL explicitly uses port ${parsed.port}.`));
    }
    if (parsed.username || parsed.password) {
        findings.push(finding("Elevated", "User information embedded", "The URL contains embedded user-information. The backend is expected to reject URLs with credentials."));
    }
    if (/[/]{3,}|[?&]{2,}|={3,}/u.test(rawWithoutScheme)) {
        findings.push(finding("Caution", "Repeated delimiters", "The URL contains repeated structural delimiters."));
    }
    if (percentEncodingCount >= 8 || percentEncodingCount * 3 > input.length * .2) {
        findings.push(finding("Caution", "Heavy percent encoding", `The URL contains ${percentEncodingCount} percent-encoded sequences.`));
    }
    if (EXECUTABLE_EXTENSIONS.test(parsed.pathname)) {
        findings.push(finding("Elevated", "Executable or script-like extension", "The path ends with a commonly executable or script-like file extension. This alone does not identify the file as malicious."));
    }
    if (redirectParameters.length) {
        findings.push(finding("Caution", "Redirect-style parameter", `The query includes: ${redirectParameters.join(", ")}.`));
    }
    if (queryEntries.length >= 10 || parsed.search.length > 500) {
        findings.push(finding("Caution", "High query complexity", `The URL contains ${queryEntries.length} query parameters and a ${parsed.search.length}-character query string.`));
    }
    if (fragmentPresent) {
        findings.push(finding("Informational", "Fragment present", "A fragment was present in the submitted value. The backend removes fragments before reputation lookup."));
    }

    return {
        normalizedUrl: normalized.href,
        protocol: parsed.protocol.replace(":", ""),
        hostname,
        port: parsed.port || "default",
        pathLength: parsed.pathname.length,
        fullLength: input.length,
        queryParameterCount: queryEntries.length,
        fragmentPresent,
        httpsUsed: parsed.protocol === "https:",
        ipHostname: isIpHostname(hostname),
        punycodeHostname: hasPunycode,
        unicodeCharacters: hasUnicode,
        findings
    };
}

export function validateSuccessResponse(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const allowedKeys = new Set([
        "schema_version", "status", "risk_score", "threats", "url_hash",
        "provider", "checked_at", "request_id"
    ]);
    if (Object.keys(payload).some(key => !allowedKeys.has(key))) return null;
    if (payload.schema_version !== "1.0" ||
        !["known_threat_detected", "no_known_threat_detected", "unavailable"].includes(payload.status) ||
        payload.provider !== "google_safe_browsing" ||
        typeof payload.url_hash !== "string" ||
        typeof payload.checked_at !== "string" ||
        !Array.isArray(payload.threats) ||
        payload.threats.some(type => typeof type !== "string" || !KNOWN_THREAT_TYPES.has(type)) ||
        !(payload.risk_score === null ||
          (Number.isInteger(payload.risk_score) && payload.risk_score >= 0 && payload.risk_score <= 100)) ||
        !(payload.request_id === undefined || typeof payload.request_id === "string")) {
        return null;
    }
    if (Number.isNaN(Date.parse(payload.checked_at))) return null;
    if (payload.status === "known_threat_detected" && payload.threats.length === 0) return null;
    if (payload.status === "no_known_threat_detected" && payload.threats.length !== 0) return null;
    if (payload.status === "unavailable" && (payload.risk_score !== null || payload.threats.length !== 0)) return null;
    return {
        schemaVersion: payload.schema_version,
        status: payload.status,
        riskScore: payload.risk_score,
        threats: [...new Set(payload.threats)].sort(),
        urlHash: payload.url_hash,
        provider: payload.provider,
        checkedAt: payload.checked_at,
        requestId: payload.request_id || null
    };
}

export function parseBackendJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        throw new Error("The Sentinel Worker returned an unreadable response.");
    }
}

/**
 * @param {boolean} ok
 * @param {unknown} payload
 * @param {string|null} retryAfter
 */
export function classifyBackendResponse(ok, payload, retryAfter = null) {
    if (!ok) {
        const unavailableResult = validateSuccessResponse(payload);
        if (unavailableResult?.status === "unavailable") {
            return { kind: "result", result: unavailableResult };
        }
        if (payload?.status === "rate_limited") {
            return {
                kind: "form_error",
                message: `Too many checks. Please wait before trying again.${retryAfter ? ` Retry after ${retryAfter} seconds.` : ""}`
            };
        }
        if (payload?.status === "invalid_request" && typeof payload.message === "string") {
            return { kind: "form_error", message: payload.message };
        }
        return { kind: "unavailable", message: "The reputation lookup is currently unavailable." };
    }
    const result = validateSuccessResponse(payload);
    return result
        ? { kind: "result", result }
        : { kind: "unavailable", message: "The Sentinel Worker returned an unexpected response." };
}

export function mapAssessment(result) {
    const mappings = {
        known_threat_detected: {
            label: "Known Threat Detected",
            classification: "High severity",
            providerStatus: "Known reputation match",
            panelClass: "is-threat",
            explanation: "One or more known threat matches were returned by the reputation provider."
        },
        no_known_threat_detected: {
            label: "No Known Threat Detected",
            classification: "No known match",
            providerStatus: "Lookup completed",
            panelClass: "is-neutral",
            explanation: "No known reputation match was returned at the time of this lookup. This is not a guarantee that the URL is harmless."
        },
        unavailable: {
            label: "Reputation Provider Unavailable",
            classification: "Unknown",
            providerStatus: "Lookup unavailable",
            panelClass: "is-unavailable",
            explanation: "The reputation lookup could not be completed. No clean assessment has been made."
        }
    };
    return mappings[result.status] || mappings.unavailable;
}

export function buildAnalystInterpretation(result, structure) {
    const elevated = structure.findings.filter(item => item.level === "Elevated");
    const cautions = structure.findings.filter(item => item.level === "Caution");
    let opening;
    if (result.status === "known_threat_detected") {
        opening = `The reputation provider returned ${result.threats.length} known threat classification${result.threats.length === 1 ? "" : "s"}.`;
    } else if (result.status === "no_known_threat_detected") {
        opening = "No known reputation match was returned.";
    } else {
        opening = "The reputation lookup was unavailable, so no clean reputation conclusion can be drawn.";
    }
    const transport = structure.httpsUsed
        ? "The URL uses HTTPS"
        : "The URL uses HTTP";
    let structural;
    if (elevated.length) {
        structural = `${elevated.length} elevated structural indicator${elevated.length === 1 ? " was" : "s were"} observed, including ${elevated[0].title.toLowerCase()}.`;
    } else if (cautions.length) {
        structural = `${cautions.length} cautionary structural indicator${cautions.length === 1 ? " was" : "s were"} observed, including ${cautions[0].title.toLowerCase()}.`;
    } else {
        structural = "No cautionary structural indicator in the Phase 2 rule set was observed.";
    }
    return `${opening} ${transport}. ${structural} Structural indicators alone do not establish malicious behavior.`;
}

export class SessionHistory {
    constructor(limit = 5) {
        this.limit = limit;
        this.entries = [];
    }

    add(result) {
        this.entries.unshift({
            status: result.status,
            checkedAt: result.checkedAt,
            hash: result.urlHash.slice(0, 28)
        });
        this.entries = this.entries.slice(0, this.limit);
    }

    clear() {
        this.entries = [];
    }

    list() {
        return this.entries.map(entry => ({ ...entry }));
    }
}

export class RequestCoordinator {
    constructor() {
        this.active = null;
    }

    begin() {
        this.active?.abort();
        this.active = new AbortController();
        return this.active;
    }

    isCurrent(controller) {
        return this.active === controller;
    }

    finish(controller) {
        if (this.active === controller) this.active = null;
    }

    cancel() {
        this.active?.abort();
        this.active = null;
    }
}

function addDefinition(list, label, value) {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = String(value);
    list.append(term, description);
}

function displayText(value) {
    return String(value || "")
        .replace(/_/gu, " ")
        .replace(/\b\w/gu, letter => letter.toUpperCase());
}

function initializeInspector() {
    const form = document.getElementById("inspector-form");
    if (!form) return;

    const input = document.getElementById("url-input");
    const analyzeButton = document.getElementById("analyze-button");
    const clearButton = document.getElementById("clear-button");
    const clearHistoryButton = document.getElementById("clear-history-button");
    const formMessage = document.getElementById("form-message");
    const lengthIndicator = document.getElementById("url-length");
    const loadingPanel = document.getElementById("loading-panel");
    const loadingMessage = document.getElementById("loading-message");
    const resultPanel = document.getElementById("result-panel");
    const liveStatus = document.getElementById("request-status");
    const historyList = document.getElementById("session-history");
    const history = new SessionHistory();
    const requests = new RequestCoordinator();
    let loadingTimer = null;

    const setBusy = busy => {
        analyzeButton.disabled = busy;
        input.disabled = busy;
        loadingPanel.hidden = !busy;
        if (!busy && loadingTimer) {
            window.clearInterval(loadingTimer);
            loadingTimer = null;
        }
    };

    const startLoading = () => {
        const messages = [
            "Validating URL",
            "Checking reputation intelligence",
            "Evaluating structural indicators"
        ];
        let index = 0;
        loadingMessage.textContent = messages[index];
        loadingTimer = window.setInterval(() => {
            index = (index + 1) % messages.length;
            loadingMessage.textContent = messages[index];
        }, 900);
    };

    const renderHistory = () => {
        const entries = history.list();
        if (!entries.length) {
            const empty = document.createElement("li");
            empty.className = "empty-history";
            empty.textContent = "No checks in this tab.";
            historyList.replaceChildren(empty);
            return;
        }
        historyList.replaceChildren(...entries.map(entry => {
            const item = document.createElement("li");
            const status = document.createElement("strong");
            const metadata = document.createElement("span");
            status.textContent = displayText(entry.status);
            metadata.textContent = `${entry.checkedAt} · ${entry.hash}…`;
            item.append(status, metadata);
            return item;
        }));
    };

    const renderResult = (result, structure) => {
        const assessment = mapAssessment(result);
        resultPanel.className = `inspector-panel result-panel ${assessment.panelClass}`;
        document.getElementById("result-status-badge").textContent = assessment.label;
        document.getElementById("assessment-label").textContent = assessment.label;
        document.getElementById("risk-score").textContent = result.riskScore === null ? "Unavailable" : `${result.riskScore} / 100`;
        document.getElementById("risk-classification").textContent = assessment.classification;
        document.getElementById("provider-status").textContent = assessment.providerStatus;
        document.getElementById("result-explanation").textContent = assessment.explanation;
        document.getElementById("analyst-interpretation").textContent = buildAnalystInterpretation(result, structure);

        const providerDetails = document.getElementById("provider-details");
        providerDetails.replaceChildren();
        addDefinition(providerDetails, "Provider", "Google Safe Browsing");
        addDefinition(providerDetails, "Query status", assessment.providerStatus);
        addDefinition(providerDetails, "Reputation result", assessment.label);
        addDefinition(providerDetails, "Threat types", result.threats.length ? result.threats.map(displayText).join(", ") : "None returned");
        addDefinition(providerDetails, "Timestamp", result.checkedAt);

        const reputationDetails = document.getElementById("reputation-details");
        const reputationText = document.createElement("p");
        reputationText.textContent = assessment.explanation;
        reputationDetails.replaceChildren(reputationText);

        const findings = document.getElementById("structural-findings");
        findings.replaceChildren(...structure.findings.map(item => {
            const row = document.createElement("article");
            const level = document.createElement("span");
            const content = document.createElement("div");
            const title = document.createElement("strong");
            const explanation = document.createElement("p");
            row.className = `finding is-${item.level.toLowerCase()}`;
            level.className = "finding-level";
            level.textContent = item.level;
            title.textContent = item.title;
            explanation.textContent = item.explanation;
            content.append(title, explanation);
            row.append(level, content);
            return row;
        }));

        const metadata = document.getElementById("technical-metadata");
        metadata.replaceChildren();
        [
            ["Normalized URL", structure.normalizedUrl],
            ["Scheme", structure.protocol],
            ["Hostname", structure.hostname],
            ["Port", structure.port],
            ["Path length", structure.pathLength],
            ["Full URL length", structure.fullLength],
            ["Query parameters", structure.queryParameterCount],
            ["Fragment before normalization", structure.fragmentPresent ? "Present" : "Not present"],
            ["Privacy-safe URL hash", result.urlHash],
            ["Schema version", result.schemaVersion],
            ["Checked time", result.checkedAt],
            ["Request ID", result.requestId || "Not returned"]
        ].forEach(([label, value]) => addDefinition(metadata, label, value));

        resultPanel.hidden = false;
        liveStatus.textContent = `${assessment.label}. Analysis complete.`;
        history.add(result);
        renderHistory();
    };

    const showFormError = message => {
        formMessage.textContent = message;
        liveStatus.textContent = message;
    };

    input.addEventListener("input", () => {
        lengthIndicator.textContent = `${input.value.length.toLocaleString()} / 2,048`;
        formMessage.textContent = "";
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();
        formMessage.textContent = "";
        resultPanel.hidden = true;
        let structure;
        try {
            structure = analyzeUrlStructure(input.value);
        }
        catch (error) {
            showFormError(error instanceof InputValidationError ? error.message : "Enter a valid URL.");
            return;
        }

        const controller = requests.begin();
        const timeout = window.setTimeout(() => controller.abort(), 12_000);
        setBusy(true);
        startLoading();
        liveStatus.textContent = "URL analysis started.";

        try {
            const response = await fetch(WORKER_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ url: input.value }),
                cache: "no-store",
                credentials: "omit",
                redirect: "error",
                signal: controller.signal
            });
            const responseText = await response.text();
            const payload = parseBackendJson(responseText);
            if (!requests.isCurrent(controller)) return;

            const interpreted = classifyBackendResponse(
                response.ok,
                payload,
                response.headers.get("Retry-After")
            );
            if (interpreted.kind === "form_error") {
                showFormError(interpreted.message);
                return;
            }
            if (interpreted.kind === "unavailable") {
                throw new Error(interpreted.message);
            }
            renderResult(interpreted.result, structure);
        }
        catch (error) {
            if (!requests.isCurrent(controller)) return;
            if (error?.name === "AbortError") {
                showFormError("The request was canceled or timed out. Please try again.");
            } else {
                showFormError(error instanceof Error ? error.message : "The reputation lookup is currently unavailable.");
            }
        }
        finally {
            window.clearTimeout(timeout);
            if (requests.isCurrent(controller)) {
                requests.finish(controller);
                setBusy(false);
            }
        }
    });

    clearButton.addEventListener("click", () => {
        requests.cancel();
        setBusy(false);
        input.disabled = false;
        analyzeButton.disabled = false;
        input.value = "";
        lengthIndicator.textContent = "0 / 2,048";
        formMessage.textContent = "";
        resultPanel.hidden = true;
        loadingPanel.hidden = true;
        liveStatus.textContent = "Inspector cleared.";
        input.focus();
    });

    clearHistoryButton.addEventListener("click", () => {
        history.clear();
        renderHistory();
        liveStatus.textContent = "Session history cleared.";
    });
}

if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", initializeInspector);
}
