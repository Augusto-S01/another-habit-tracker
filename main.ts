import { lastNDaysISO, getNDaysStatistics, normalizeEntries, Habit } from "core";
import { App, Modal, MarkdownPostProcessorContext, Notice, Plugin, PluginSettingTab, Setting, TFile, normalizePath } from "obsidian";

interface AnotherHabitTrackerSettings {
  habitsPath: string;
}

const DEFAULT_SETTINGS: AnotherHabitTrackerSettings = {
  habitsPath: "Habits",
};

class HabitsListModal extends Modal {
  constructor(app: App, private habitsPath: string) {
    super(app);
  }

  private todayISO(): string {
    return getLocalDateISO();
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("aht-modal");

    const today = this.todayISO();

    const header = contentEl.createDiv({ cls: "aht-modal__header" });

    const titleRow = header.createDiv({ cls: "aht-modal__titleRow" });
    titleRow.createEl("h2", { text: "Another Habit Tracker" });
    titleRow.createDiv({ cls: "aht-pill", text: today });

    header.createDiv({
      cls: "aht-modal__subtitle",
      text: `Folder: ${this.habitsPath}`,
    });

    const files = await listHabitFiles(this.app, this.habitsPath);

    if (files.length === 0) {
      const empty = contentEl.createDiv({ cls: "aht-empty" });
      empty.createEl("p", { text: "Nenhum hábito encontrado nessa pasta." });
      return;
    }

    const stats = contentEl.createDiv({ cls: "aht-stats" });
    const statsText = stats.createDiv({ cls: "aht-stats__text" });

    const progressOuter = stats.createDiv({ cls: "aht-progress" });
    const progressInner = progressOuter.createDiv({ cls: "aht-progress__bar" });

    const list = contentEl.createDiv({ cls: "aht-list" });

    let doneCount = 0;

    const items: Array<{
      file: TFile;
      rowEl: HTMLDivElement;
      cb: HTMLInputElement;
    }> = [];

    for (const file of files) {
      const entries = await getEntries(this.app, file);
      const doneToday = entries.includes(today);
      if (doneToday) doneCount++;

      const rowEl = list.createDiv({ cls: "aht-item" });
      if (doneToday) rowEl.addClass("is-done");

      const btn = rowEl.createEl("button", { cls: "aht-item__btn" });

      const cb = btn.createEl("input", {
        type: "checkbox",
        cls: "aht-item__cb",
      });
      cb.checked = doneToday;

      const texts = btn.createDiv({ cls: "aht-item__texts" });
      texts.createDiv({ cls: "aht-item__name", text: file.basename });
      texts.createDiv({
        cls: "aht-item__meta",
        text: doneToday ? "Done" : "Pending",
      });

      btn.addEventListener("click", (ev) => {
        if (ev.target === cb) return;
        cb.click();
      });

      cb.onchange = async () => {
        cb.disabled = true;
        try {
          await toggleEntry(this.app, file, today, cb.checked);
          rowEl.toggleClass("is-done", cb.checked);
          texts.querySelector(".aht-item__meta")!.textContent = cb.checked ? "Done" : "Pending";

          doneCount += cb.checked ? 1 : -1;
          updateStats();
        } finally {
          cb.disabled = false;
        }
      };

      items.push({ file, rowEl, cb });
    }

    const updateStats = () => {
      statsText.textContent = `Today: ${doneCount}/${files.length}`;
      const pct = Math.round((doneCount / files.length) * 100);
      progressInner.style.width = `${pct}%`;
      progressInner.setAttr("aria-valuenow", String(pct));
    };

    updateStats();
  }

  onClose() {
    this.contentEl.empty();
  }
}


class AnotherHabitTrackerSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: AnotherHabitTrackerPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Another Habit Tracker — Settings" });

    new Setting(containerEl)
      .setName("Habits folder")
      .setDesc('Path to the folder inside the vault. Ex: "Habits"')
      .addText((text) =>
        text
          .setPlaceholder("Habits")
          .setValue(this.plugin.settings.habitsPath)
          .onChange(async (value) => {
            this.plugin.settings.habitsPath = value.trim() || DEFAULT_SETTINGS.habitsPath;
            await this.plugin.saveSettings();
          })
      );
  }
}

export default class AnotherHabitTrackerPlugin extends Plugin {
  settings: AnotherHabitTrackerSettings;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.addSettingTab(new AnotherHabitTrackerSettingTab(this.app, this));
    this.addCommand({
      id: "open-habit-modal",
      name: "Open habit checklist",
      callback: () => {
        new HabitsListModal(this.app, this.settings.habitsPath).open();
      },
    });

    this.addRibbonIcon("check-circle", "Another Habit Tracker", () => {
      new HabitsListModal(this.app, this.settings.habitsPath).open();
    });

    this.registerMarkdownCodeBlockProcessor(
      "another-habit-tracker-timeline",
      async (source, el) => {
        el.empty();

        const days = parseDaysFromSource(source, 10);
        const files = await listHabitFiles(this.app, this.settings.habitsPath);

        if (files.length === 0) {
          el.createEl("p", { text: "No habits found in the specified folder." });
          return;
        }

        const habits = await getHabits(this.app, files);

        const datesDesc = lastNDaysISO(days);         
        const labels = datesDesc.map(dayOfMonthLabel); 
        const cellPx = 22;   
        const namePx = 180;

        const root = el.createDiv({ cls: "aht-grid-root" });
        root.style.setProperty("--aht-days", String(days));
        root.style.setProperty("--aht-cell", `${cellPx}px`);
        root.style.setProperty("--aht-name", `${namePx}px`);

        const scroller = root.createDiv({ cls: "aht-grid-scroll" });
        const table = scroller.createDiv({ cls: "aht-grid-table" });


        const header = table.createDiv({ cls: "aht-grid-row aht-grid-header" });
        header.createDiv({ cls: "aht-grid-cell aht-grid-name aht-grid-name--header", text: "Habits" });

        for (const lbl of labels) {
          header.createDiv({ cls: "aht-grid-cell aht-grid-day aht-grid-day--header", text: lbl });
        }


        for (const h of habits) {
          const row = table.createDiv({ cls: "aht-grid-row aht-grid-bodyrow" });

          const nameCell = row.createDiv({ cls: "aht-grid-cell aht-grid-name" });
          const item = nameCell.createDiv({ cls: "aht-habit-item" });

          const name = item.createDiv({ cls: "aht-habit-name", text: h.habitName });
          item.onclick = async () => {
            const f = this.app.vault.getAbstractFileByPath(h.file);
            if (f instanceof TFile) await this.app.workspace.getLeaf(true).openFile(f);
          };

          item.setAttr("role", "button");
          item.setAttr("tabindex", "0");
          item.addEventListener("keydown", async (ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              const f = this.app.vault.getAbstractFileByPath(h.file);
              if (f instanceof TFile) await this.app.workspace.getLeaf(true).openFile(f);
            }
          });

          const set = new Set(h.entries); 
          const doneFlags = datesDesc.map((d) => set.has(d));


          addRunLines(row, doneFlags, namePx, cellPx);

          for (let i = 0; i < datesDesc.length; i++) {
            const dayCell = row.createDiv({ cls: "aht-grid-cell aht-grid-day" });
            const dot = dayCell.createDiv({ cls: "aht-dot" });
            if (doneFlags[i]) dot.addClass("is-on");
          }
        }
      }
    );


    function addRunLines(row: HTMLElement, done: boolean[], namePx: number, cellPx: number) {
      let i = 0;
      while (i < done.length) {
        if (!done[i]) { i++; continue; }

        let start = i;
        while (i < done.length && done[i]) i++;
        let end = i - 1;

        if (end - start + 1 >= 2) {
          const line = row.createDiv({ cls: "aht-runline" });
          const left = namePx + start * cellPx + cellPx / 2;
          const width = (end - start) * cellPx;
          line.style.left = `${left}px`;
          line.style.width = `${width}px`;
        }
      }
    }

    function parseDaysFromSource(source: string, fallback = 10): number {
      const m = source.match(/(\d+)/);
      const n = m ? parseInt(m[1], 10) : fallback;
      return Math.max(1, Math.min(n, 60));
    }

    function dayOfMonthLabel(iso: string): string {
      return String(parseInt(iso.slice(8, 10), 10));
    }


    this.registerMarkdownCodeBlockProcessor(
      "another-habit-tracker",
      async (_source, el) => {
        el.empty();
        el.addClass("aht-block");

        const files = await listHabitFiles(this.app, this.settings.habitsPath);
        const total = files.length;

        if (total === 0) {
          el.createEl("p", { text: "No habits found in the specified folder." });
          return;
        }

        const today = getLocalDateISO();
        const habits = await getHabits(this.app, files);

        const N = 10;
        const stats = await getNDaysStatistics(habits, N);

        const doneToday = habits.reduce((acc, h) => acc + (h.entries.includes(today) ? 1 : 0), 0);

        const card = el.createDiv({ cls: "aht-card" });
        const header = card.createDiv({ cls: "aht-card__header" });
        header.createDiv({ cls: "aht-card__title", text: "Habit Tracker" });
        header.createDiv({ cls: "aht-pill", text: today });

        const grid = card.createDiv({ cls: "aht-card__grid" });


        const todayBox = grid.createDiv({ cls: "aht-metric" });
        todayBox.createDiv({ cls: "aht-metric__label", text: "Today" });
        todayBox.createDiv({ cls: "aht-metric__value", text: `${doneToday}/${total}` });


        const avgBox = grid.createDiv({ cls: "aht-metric" });
        avgBox.createDiv({ cls: "aht-metric__label", text: `Average (${N} days)` });
        avgBox.createDiv({
          cls: "aht-metric__value",
          text: `${stats.avgHabitsDonePerDay.toFixed(1)}/${total}`,
        });

        const consBox = grid.createDiv({ cls: "aht-metric" });
        consBox.createDiv({ cls: "aht-metric__label", text: "Consistency" });
        consBox.createDiv({ cls: "aht-metric__value", text: `${stats.consistencyStreak.length}d` });

        const bestBox = grid.createDiv({ cls: "aht-metric" });
        bestBox.createDiv({ cls: "aht-metric__label", text: "Best streak" });
        bestBox.createDiv({
          cls: "aht-metric__value",
          text: `${stats.bestHabitStreak.length}d`,
        });
        bestBox.createDiv({
          cls: "aht-metric__hint",
          text: stats.bestHabitStreak.habitName || "-",
        });


        const worst = stats.habitWithLowestCompletionRate;
        const worstBox = grid.createDiv({ cls: "aht-metric aht-metric--wide" });
        worstBox.createDiv({ cls: "aht-metric__label", text: `Less done (${N} days)` });
        worstBox.createDiv({
          cls: "aht-metric__value",
          text: worst.habitName ? worst.habitName : "-",
        });
        worstBox.createDiv({
          cls: "aht-metric__hint",
          text: worst.habitName ? `${Math.round(worst.rate * 100)}%` : "",
        });


        const actions = card.createDiv({ cls: "aht-card__actions" });
        const btn = actions.createEl("button", { cls: "aht-btn aht-btn--primary", text: "Open Habits CheckList" });
        btn.onclick = () => new HabitsListModal(this.app, this.settings.habitsPath).open();
      }
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}


async function toggleEntry(app: App, file: TFile, date: string, add: boolean = true) {
  await app.fileManager.processFrontMatter(file, (metadata: any) => {
    console.log(metadata);
    let entries = normalizeEntries(metadata.entries);

    if (add) {
      if (!entries.includes(date)) {
        entries.push(date);
      }
    } else {
      entries = entries.filter((d: string) => d !== date);
    }
    metadata.entries = normalizeEntries(entries);
  });
}

async function listHabitFiles(app: App, habitsPath: string): Promise<TFile[]> {
  const prefix = normalizePath(habitsPath).replace(/\/$/, "") + "/";
  return app.vault
    .getMarkdownFiles()
    .filter((f) => f.path.startsWith(prefix));
}

async function getEntries(app: App, file: TFile): Promise<string[]> {
  const allEntries: string[] = [];
  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  const entries = fm?.entries;
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (typeof entry === "string") {
        allEntries.push(entry);
      }
    }
  }
  return normalizeEntries(allEntries);
}

async function getHabits(app: App, files: TFile[]): Promise<Habit[]> {
  return Promise.all(
    files.map(async (file) => ({
      file: file.path,
      habitName: file.basename,
      entries: await getEntries(app, file),
    }))
  );
}



function getLocalDateISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}


function parseDaysFromSource(source: string, fallback = 10): number {
  const m = source.match(/(\d+)/);
  const n = m ? parseInt(m[1], 10) : fallback;
  return clamp(n, 1, 60);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function dayOfMonthLabel(iso: string): string {
  const d = parseInt(iso.slice(8, 10), 10);
  return String(d); 
}

function setTrackWidth(el: HTMLElement, days: number) {
  const step = 18; 
  el.style.width = `${days * step}px`;
  el.style.minWidth = `${days * step}px`;
}

function buildTimelineSvg(done: boolean[]): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const step = 18;
  const w = done.length * step;
  const h = 16;
  const cy = 8;

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "aht-tl-svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));

  for (let i = 0; i < done.length; i++) {
    const cx = i * step + step / 2;
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", String(cx));
    c.setAttribute("cy", String(cy));
    c.setAttribute("r", "2");
    c.setAttribute("class", "aht-tl-dot aht-tl-dot--off");
    svg.appendChild(c);
  }

  for (let i = 0; i < done.length; i++) {
    const cx = i * step + step / 2;

    if (done[i] && i > 0 && done[i - 1]) {
      const x1 = (i - 1) * step + step / 2;
      const x2 = cx;
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", String(x1));
      line.setAttribute("y1", String(cy));
      line.setAttribute("x2", String(x2));
      line.setAttribute("y2", String(cy));
      line.setAttribute("class", "aht-tl-line");
      svg.appendChild(line);
    }

    if (done[i]) {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", String(cx));
      c.setAttribute("cy", String(cy));
      c.setAttribute("r", "3");
      c.setAttribute("class", "aht-tl-dot aht-tl-dot--on");
      svg.appendChild(c);
    }
  }

  return svg;
}

