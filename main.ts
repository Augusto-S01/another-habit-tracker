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

    const today = this.todayISO();

    contentEl.createEl("h2", { text: "Another Habit Tracker" });
    contentEl.createEl("p", { text: `Pasta: ${this.habitsPath}` });
    contentEl.createEl("p", { text: `Hoje: ${today}` });

    const files = await listHabitFiles(this.app, this.habitsPath);

    if (files.length === 0) {
      contentEl.createEl("p", { text: "Nenhum hábito encontrado nessa pasta." });
      return;
    }

    const list = contentEl.createDiv({ cls: "aht-list" });


    for (const file of files) {
      const row = list.createDiv({ cls: "aht-row" });
      const label = row.createEl("label");
      const cb = label.createEl("input", { type: "checkbox" });

      const entries = await getEntries(this.app, file);
      cb.checked = entries.includes(today);

      cb.onchange = async () => {
        await toggleEntry(this.app, file, today, cb.checked);
      };

      label.appendText(" " + file.basename);
    }


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

      // TODO depois: last 7 days rate, streak, etc
      
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


function getLocalDateISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeEntries(entries: unknown): string[] {
  if (!Array.isArray(entries)) return [];
  const onlyStrings = entries.filter((x): x is string => typeof x === "string");
  return Array.from(new Set(onlyStrings)).sort();
}