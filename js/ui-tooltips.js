// ==========================================
// UI-TOOLTIPS.JS - ALT + HOVER Tooltip System
// ==========================================

let isAltPressed = false;

function initUITooltips() {
    const uiTooltip = document.createElement('div');
    uiTooltip.className = 'ui-tooltip';
    uiTooltip.style.display = 'none';
    document.body.appendChild(uiTooltip);

    let activeElement = null;

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Alt') {
            isAltPressed = true;
            document.body.classList.add('alt-pressed');
            if (activeElement) showHint(activeElement, uiTooltip);
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'Alt') {
            isAltPressed = false;
            document.body.classList.remove('alt-pressed');
            uiTooltip.style.display = 'none';
        }
    });

    document.addEventListener('mouseover', (e) => {
        const hintEl = e.target.closest('[data-hint]');
        if (hintEl) {
            activeElement = hintEl;
            if (isAltPressed) showHint(hintEl, uiTooltip);
        }
    });

    document.addEventListener('mouseout', (e) => {
        const hintEl = e.target.closest('[data-hint]');
        if (hintEl) {
            activeElement = null;
            uiTooltip.style.display = 'none';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (uiTooltip.style.display === 'block') {
            positionTooltip(e, uiTooltip);
        }
    });
}

function showHint(el, uiTooltip) {
    const hint = el.getAttribute('data-hint');
    const label = el.querySelector('label')?.textContent || el.textContent || "Hint";
    
    uiTooltip.innerHTML = `<b>${label.replace(':', '')}</b>${hint}`;
    uiTooltip.style.display = 'block';
}

function positionTooltip(e, uiTooltip) {
    const x = e.pageX + 15;
    const y = e.pageY + 15;
    
    const width = uiTooltip.offsetWidth;
    const rightEdge = window.innerWidth + window.scrollX;
    
    let finalX = x;
    if (x + width > rightEdge) {
        finalX = e.pageX - width - 15;
    }

    uiTooltip.style.left = finalX + 'px';
    uiTooltip.style.top = y + 'px';
}
