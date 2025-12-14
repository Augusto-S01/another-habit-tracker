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
      text: `Pasta: ${this.habitsPath}`,
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
        text: doneToday ? "Feito hoje" : "Pendente",
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
          texts.querySelector(".aht-item__meta")!.textContent = cb.checked ? "Feito hoje" : "Pendente";

          doneCount += cb.checked ? 1 : -1;
          updateStats();
        } finally {
          cb.disabled = false;
        }
      };

      items.push({ file, rowEl, cb });
    }

    const updateStats = () => {
      statsText.textContent = `Hoje: ${doneCount}/${files.length}`;
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
      .setDesc('Caminho da pasta dentro do vault. Ex: "Habits"')
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
    console.log(lastNDaysISO(10));
    this.addCommand({
      id: "open-habit-modal",
      name: "Open habit modal",
      callback: () => {
        new HabitsListModal(this.app, this.settings.habitsPath).open();
      },
    });

  this.registerMarkdownCodeBlockProcessor(
    "another-habit-tracker",
    async (_source, el, _ctx) => {
      el.empty();

      const files = await listHabitFiles(this.app, this.settings.habitsPath);
      const total = files.length;
      console.log("statistics:")
      console.log(await getNDaysStatistics(await getHabits(this.app,files),this.app,10))
      if (total === 0) {
        el.createEl("p", { text: "No habits found in the specified folder." });
        return;
      }

      const today = getLocalDateISO();

      let doneToday = 0;

      for (const file of files) {
        const entries = await getEntries(this.app, file);
        if (entries.includes(today)) {
          doneToday++;
        }
      }

      const header = el.createDiv({ cls: "aht-card" });
      header.createEl("h3", { text: "Habit Tracker" });
      header.createEl("p", { text: `Today: ${doneToday}/${total}` });


    }
  );

 




    new Notice("Another Habit Tracker loaded");
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



