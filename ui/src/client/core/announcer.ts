/**
 * Announcer for aria-live accessibility messages.
 * Handles polite and assertive announcements for screen readers.
 */
export class Announcer {
    private static instance: Announcer;
    private polite: HTMLElement | null = null;
    private assertive: HTMLElement | null = null;

    static getInstance(): Announcer {
        if (!Announcer.instance) Announcer.instance = new Announcer();
        return Announcer.instance;
    }

    announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
        this.ensureRegions();
        const region = priority === 'assertive' ? this.assertive! : this.polite!;
        // Clear first then set to trigger announcement even for duplicate messages
        region.textContent = '';
        requestAnimationFrame(() => {
            region.textContent = message;
        });
    }

    private ensureRegions() {
        if (!this.polite) {
            this.polite = document.createElement('div');
            this.polite.setAttribute('aria-live', 'polite');
            this.polite.setAttribute('aria-atomic', 'true');
            this.polite.className = 'sr-only';
            document.body.appendChild(this.polite);
        }
        if (!this.assertive) {
            this.assertive = document.createElement('div');
            this.assertive.setAttribute('aria-live', 'assertive');
            this.assertive.setAttribute('aria-atomic', 'true');
            this.assertive.className = 'sr-only';
            document.body.appendChild(this.assertive);
        }
    }
}
