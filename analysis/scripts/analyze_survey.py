#!/usr/bin/env python
"""Generate reusable age-grouped survey analysis assets.

The script reads a Credamo CSV export with two header rows, keeps the raw file
untouched, and writes a Markdown report, CSV tables, PNG figures, and a compact
processed dataset.
"""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from textwrap import dedent
from typing import Any

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import yaml
from matplotlib import font_manager


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = ROOT / "analysis" / "config" / "survey_schema.yml"
DEFAULT_REPORT = ROOT / "analysis" / "report.md"
DEFAULT_OUTPUT = ROOT / "analysis" / "outputs" / date.today().isoformat()


@dataclass
class OutputPaths:
    root: Path
    figures: Path
    tables: Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze AI butler survey data by age group.")
    parser.add_argument("--input", required=True, type=Path, help="Path to raw Credamo CSV.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output run directory.")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG, help="Survey schema YAML.")
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT, help="Markdown report path.")
    return parser.parse_args()


def ensure_paths(output_root: Path) -> OutputPaths:
    output_root = output_root.resolve()
    paths = OutputPaths(root=output_root, figures=output_root / "figures", tables=output_root / "tables")
    for path in (paths.root, paths.figures, paths.tables):
        path.mkdir(parents=True, exist_ok=True)
    return paths


def load_config(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def setup_plot_style() -> None:
    candidates = [
        "Microsoft YaHei",
        "SimHei",
        "Noto Sans CJK SC",
        "Source Han Sans SC",
        "Arial Unicode MS",
    ]
    installed = {font_manager.FontProperties(fname=fp).get_name() for fp in font_manager.findSystemFonts()}
    for name in candidates:
        if name in installed:
            plt.rcParams["font.sans-serif"] = [name]
            break
    plt.rcParams["axes.unicode_minus"] = False
    sns.set_theme(style="whitegrid", font=plt.rcParams["font.sans-serif"][0] if plt.rcParams["font.sans-serif"] else None)


def read_credamo_csv(path: Path, encoding: str) -> tuple[pd.DataFrame, list[str], list[str]]:
    raw_header = pd.read_csv(path, encoding=encoding, nrows=0).columns.tolist()
    short_header = pd.read_csv(path, encoding=encoding, header=None, skiprows=1, nrows=1).iloc[0].fillna("").tolist()
    df = pd.read_csv(path, encoding=encoding, header=0, skiprows=[1], dtype=str).fillna("")
    df = df.apply(lambda col: col.str.strip() if col.dtype == "object" else col)
    return df, raw_header, short_header


def col(config: dict[str, Any], key: str) -> str:
    return config["columns"][key]


def clean_option_label(text: str) -> str:
    label = str(text).strip()
    label = re.sub(r"^[A-I]\.\s*", "", label)
    label = label.replace("______", "").strip()
    return label


def option_code(text: str) -> str:
    match = re.match(r"\s*([A-Z])\.?", str(text).strip())
    return match.group(1) if match else ""


def pct(part: int | float, whole: int | float) -> float:
    return round(float(part) / float(whole) * 100, 1) if whole else 0.0


def safe_filename(name: str) -> str:
    base = re.sub(r"[^0-9A-Za-z_-]+", "_", name).strip("_")
    return base[:80] or "table"


def table_path(paths: OutputPaths, name: str) -> Path:
    return paths.tables / f"{safe_filename(name)}.csv"


def figure_path(paths: OutputPaths, name: str) -> Path:
    return paths.figures / f"{safe_filename(name)}.png"


def save_table(df: pd.DataFrame, paths: OutputPaths, name: str) -> Path:
    path = table_path(paths, name)
    df.to_csv(path, index=False, encoding="utf-8-sig")
    return path


def value_counts_table(df: pd.DataFrame, column: str, sample_size: int) -> pd.DataFrame:
    counts = df[column].replace("", np.nan).dropna().value_counts()
    out = counts.rename_axis("option").reset_index(name="count")
    out["pct"] = out["count"].map(lambda x: pct(x, sample_size))
    return out


def by_age_counts(df: pd.DataFrame, column: str, age_col: str, age_order: list[str]) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for age in age_order:
        subset = df[df[age_col] == age]
        counts = value_counts_table(subset, column, len(subset))
        for _, row in counts.iterrows():
            rows.append({"age_group": age, "option": row["option"], "count": row["count"], "pct": row["pct"]})
    return pd.DataFrame(rows)


def proportion_matrix(df: pd.DataFrame, column: str, age_col: str, age_order: list[str]) -> pd.DataFrame:
    options = df[column].replace("", np.nan).dropna().value_counts().index.tolist()
    matrix = pd.crosstab(df[age_col], df[column], normalize="index") * 100
    matrix = matrix.reindex(age_order).fillna(0)
    return matrix.reindex(columns=options, fill_value=0)


def plot_age_distribution(df: pd.DataFrame, config: dict[str, Any], paths: OutputPaths) -> Path:
    age_col = col(config, "age")
    age_order = config["age_order"]
    counts = df[age_col].value_counts().reindex(age_order, fill_value=0).reset_index()
    counts.columns = ["年龄段", "样本数"]
    counts["占比"] = counts["样本数"].map(lambda x: pct(x, len(df)))
    save_table(counts, paths, "age_distribution")

    fig, ax = plt.subplots(figsize=(8, 5))
    sns.barplot(data=counts, x="年龄段", y="样本数", color="#3B82F6", ax=ax)
    for i, row in counts.iterrows():
        ax.text(i, row["样本数"] + 0.6, f'{int(row["样本数"])}\n{row["占比"]}%', ha="center", va="bottom", fontsize=10)
    ax.set_title("年龄段样本分布")
    ax.set_xlabel("")
    ax.set_ylabel("样本数")
    fig.tight_layout()
    path = figure_path(paths, "fig_age_distribution")
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_duration(df: pd.DataFrame, config: dict[str, Any], paths: OutputPaths) -> Path:
    duration_col = col(config, "duration_sec")
    duration = pd.to_numeric(df[duration_col], errors="coerce").dropna()
    summary = pd.DataFrame(
        [
            {
                "count": int(duration.count()),
                "min": duration.min(),
                "p25": duration.quantile(0.25),
                "median": duration.median(),
                "mean": duration.mean(),
                "p75": duration.quantile(0.75),
                "max": duration.max(),
            }
        ]
    ).round(1)
    save_table(summary, paths, "duration_summary")

    bins = [0, 90, 150, 180, 300, 600, math.inf]
    labels = ["<90s", "90-149s", "150-179s", "180-299s", "300-599s", ">=600s"]
    bucket = pd.cut(duration, bins=bins, labels=labels, right=False)
    bucket_table = bucket.value_counts(sort=False).rename_axis("bucket").reset_index(name="count")
    bucket_table["pct"] = bucket_table["count"].map(lambda x: pct(x, len(duration)))
    save_table(bucket_table, paths, "duration_buckets")

    fig, ax = plt.subplots(figsize=(8, 5))
    sns.histplot(duration, bins=14, color="#10B981", edgecolor="white", ax=ax)
    ax.axvline(duration.median(), color="#DC2626", linestyle="--", linewidth=1.5, label=f"中位数 {duration.median():.0f}s")
    ax.axvline(duration.mean(), color="#F59E0B", linestyle="--", linewidth=1.5, label=f"均值 {duration.mean():.0f}s")
    ax.set_title("作答总时长分布")
    ax.set_xlabel("作答总时长（秒）")
    ax.set_ylabel("样本数")
    ax.legend()
    fig.tight_layout()
    path = figure_path(paths, "fig_duration_hist")
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_stacked_by_age(
    df: pd.DataFrame,
    config: dict[str, Any],
    paths: OutputPaths,
    key: str,
    filename: str,
) -> Path:
    age_col = col(config, "age")
    column = col(config, config["single_choice"][key]["column"])
    title = config["single_choice"][key]["title"]
    age_order = config["age_order"]
    matrix = proportion_matrix(df, column, age_col, age_order)
    save_table(by_age_counts(df, column, age_col, age_order), paths, f"{filename}_by_age")

    fig, ax = plt.subplots(figsize=(10, 5.8))
    left = np.zeros(len(matrix))
    palette = sns.color_palette("Set2", n_colors=max(3, len(matrix.columns)))
    for i, option in enumerate(matrix.columns):
        vals = matrix[option].values
        ax.barh(matrix.index, vals, left=left, label=clean_option_label(option), color=palette[i])
        left += vals
    ax.set_title(f"{title}：按年龄段对比")
    ax.set_xlabel("占比（%）")
    ax.set_ylabel("")
    ax.set_xlim(0, 100)
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.15), ncol=2, frameon=False, fontsize=9)
    fig.tight_layout()
    path = figure_path(paths, filename)
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    return path


def multi_select_columns(df: pd.DataFrame, prefix: str) -> list[str]:
    return [
        c
        for c in df.columns
        if c.startswith(prefix)
        and not c.endswith("-文本")
        and " 方差" not in c
        and " 均值" not in c
        and "作答时长" not in c
    ]


def multi_select_table(df: pd.DataFrame, prefix: str, sample_size: int) -> pd.DataFrame:
    rows = []
    for column in multi_select_columns(df, prefix):
        selected = df[column].astype(str).str.strip().isin({"1", "1.0", "TRUE", "true", "是"})
        rows.append(
            {
                "option": clean_option_label(column.replace(prefix, "")),
                "count": int(selected.sum()),
                "pct": pct(int(selected.sum()), sample_size),
                "source_column": column,
            }
        )
    return pd.DataFrame(rows).sort_values(["count", "option"], ascending=[False, True]).reset_index(drop=True)


def multi_select_by_age(df: pd.DataFrame, prefix: str, age_col: str, age_order: list[str]) -> pd.DataFrame:
    rows = []
    for age in age_order:
        subset = df[df[age_col] == age]
        table = multi_select_table(subset, prefix, len(subset))
        for _, row in table.iterrows():
            rows.append({"age_group": age, "option": row["option"], "count": row["count"], "pct": row["pct"]})
    return pd.DataFrame(rows)


def plot_multi_by_age(
    df: pd.DataFrame,
    config: dict[str, Any],
    paths: OutputPaths,
    key: str,
    filename: str,
    table_name: str | None = None,
    top_n: int = 7,
) -> Path:
    age_col = col(config, "age")
    age_order = config["age_order"]
    group = config["multi_select"][key]
    prefix = group["prefix"]
    title = group["title"]
    overall = multi_select_table(df, prefix, len(df)).head(top_n)
    by_age = multi_select_by_age(df, prefix, age_col, age_order)
    table_name = table_name or filename
    save_table(multi_select_table(df, prefix, len(df)), paths, f"{table_name}_overall")
    save_table(by_age, paths, f"{table_name}_by_age")

    options = overall["option"].tolist()
    plot_df = by_age[by_age["option"].isin(options)].copy()
    plot_df["option"] = pd.Categorical(plot_df["option"], categories=list(reversed(options)), ordered=True)
    plot_df["age_group"] = pd.Categorical(plot_df["age_group"], categories=age_order, ordered=True)

    fig, ax = plt.subplots(figsize=(10, max(5.2, len(options) * 0.6)))
    sns.barplot(data=plot_df, y="option", x="pct", hue="age_group", ax=ax, palette="Blues")
    ax.set_title(f"{title}：Top {len(options)} 按年龄段对比")
    ax.set_xlabel("选择占比（%）")
    ax.set_ylabel("")
    ax.legend(title="年龄段", loc="lower right", frameon=True)
    fig.tight_layout()
    path = figure_path(paths, filename)
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_self_check(df: pd.DataFrame, config: dict[str, Any], paths: OutputPaths) -> Path:
    most = value_counts_table(df, col(config, "self_check_most"), len(df)).rename(columns={"count": "most_count", "pct": "most_pct"})
    least = value_counts_table(df, col(config, "self_check_least"), len(df)).rename(columns={"count": "least_count", "pct": "least_pct"})
    merged = most.merge(least, on="option", how="outer").fillna(0)
    merged = merged.sort_values("most_pct", ascending=False)
    save_table(merged, paths, "self_check_most_vs_least")

    plot_df = merged.melt(id_vars="option", value_vars=["most_pct", "least_pct"], var_name="type", value_name="pct")
    plot_df["type"] = plot_df["type"].map({"most_pct": "最看重", "least_pct": "最不看重"})
    fig, ax = plt.subplots(figsize=(9, 5.6))
    sns.barplot(data=plot_df, y="option", x="pct", hue="type", palette=["#2563EB", "#F97316"], ax=ax)
    ax.set_title("方案自检项：最看重 vs 最不看重")
    ax.set_xlabel("占比（%）")
    ax.set_ylabel("")
    ax.legend(title="")
    fig.tight_layout()
    path = figure_path(paths, "fig_self_check_importance")
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    return path


def ranking_tables_and_plot(df: pd.DataFrame, config: dict[str, Any], paths: OutputPaths) -> Path:
    age_col = col(config, "age")
    age_order = config["age_order"]
    prefix = config["ranking"]["priority_scenarios"]["prefix"]
    ranking_cols = [c for c in df.columns if c.startswith(prefix) and " 方差" not in c and " 均值" not in c]

    rows = []
    heat_rows = []
    for column in ranking_cols:
        scenario = clean_option_label(column.replace(prefix, ""))
        values = pd.to_numeric(df[column], errors="coerce")
        rows.append({"scenario": scenario, "mean_rank": round(values.mean(), 2), "n": int(values.count())})
        heat_row = {"scenario": scenario}
        for age in age_order:
            age_values = pd.to_numeric(df.loc[df[age_col] == age, column], errors="coerce")
            heat_row[age] = round(age_values.mean(), 2)
        heat_rows.append(heat_row)
    overall = pd.DataFrame(rows).sort_values("mean_rank")
    heat = pd.DataFrame(heat_rows).set_index("scenario").loc[overall["scenario"]]
    save_table(overall, paths, "priority_scenario_ranking_overall")
    save_table(heat.reset_index(), paths, "priority_scenario_ranking_by_age")

    fig, ax = plt.subplots(figsize=(10, 5.8))
    sns.heatmap(heat, annot=True, fmt=".2f", cmap="YlGnBu_r", cbar_kws={"label": "平均排名（越低越优先）"}, ax=ax)
    ax.set_title("AI 管家优先场景排序：按年龄段平均排名")
    ax.set_xlabel("年龄段")
    ax.set_ylabel("")
    fig.tight_layout()
    path = figure_path(paths, "fig_priority_ranking_heatmap")
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_group_dining_funnel(df: pd.DataFrame, config: dict[str, Any], paths: OutputPaths) -> Path:
    freq = col(config, "group_outing_frequency")
    difficulty = col(config, "group_dining_difficulty")
    action = col(config, "group_conflict_action")
    explain = col(config, "explanation_preference")

    has_group_scene = df[freq].str.contains("每周|每月", regex=True, na=False)
    has_difficulty = has_group_scene & df[difficulty].str.contains("经常|有时", regex=True, na=False)
    willing_ai = has_difficulty & df[action].str.startswith("A.", na=False)
    wants_explain = willing_ai & df[explain].str.startswith(("A.", "B."), na=False)
    stages = [
        ("有线下约饭/聚会场景", has_group_scene),
        ("遇到约饭难定", has_difficulty),
        ("愿意尝试 AI 折中", willing_ai),
        ("希望解释照顾/牺牲", wants_explain),
    ]
    table = pd.DataFrame(
        [{"stage": name, "count": int(mask.sum()), "pct_of_total": pct(int(mask.sum()), len(df))} for name, mask in stages]
    )
    save_table(table, paths, "group_dining_funnel")

    fig, ax = plt.subplots(figsize=(9, 5))
    sns.barplot(data=table, y="stage", x="pct_of_total", color="#7C3AED", ax=ax)
    for i, row in table.iterrows():
        ax.text(row["pct_of_total"] + 1, i, f'{int(row["count"])}人 / {row["pct_of_total"]}%', va="center")
    ax.set_xlim(0, 105)
    ax.set_title("多人约饭核心链路")
    ax.set_xlabel("占总样本比例（%）")
    ax.set_ylabel("")
    fig.tight_layout()
    path = figure_path(paths, "fig_group_dining_funnel")
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    return path


def code_open_text(df: pd.DataFrame, config: dict[str, Any], paths: OutputPaths) -> tuple[pd.DataFrame, pd.DataFrame, Path]:
    answer_col = col(config, "answer_id")
    text_col = col(config, "open_text")
    themes = config["open_text_themes"]
    coded_rows = []
    theme_rows = []
    examples: dict[str, str] = {}

    for _, row in df.iterrows():
        text = str(row.get(text_col, "")).strip()
        matched = []
        if text:
            lower = text.lower()
            for theme, keywords in themes.items():
                if any(str(keyword).lower() in lower for keyword in keywords):
                    matched.append(theme)
                    examples.setdefault(theme, text)
            if not matched:
                matched.append("其他具体经历")
                examples.setdefault("其他具体经历", text)
        else:
            matched.append("未填写")
        coded_rows.append({col(config, "answer_id"): row.get(answer_col, ""), "text": text, "themes": "；".join(matched)})

    coded = pd.DataFrame(coded_rows)
    counts = Counter()
    for themes_text in coded["themes"]:
        for theme in str(themes_text).split("；"):
            counts[theme] += 1
    for theme, count in counts.most_common():
        theme_rows.append({"theme": theme, "count": count, "pct_of_responses": pct(count, len(df)), "example": examples.get(theme, "")})
    theme_table = pd.DataFrame(theme_rows)
    save_table(coded, paths, "open_text_coded")
    save_table(theme_table, paths, "open_text_theme_counts")

    plot_df = theme_table[theme_table["theme"] != "未填写"].copy()
    fig, ax = plt.subplots(figsize=(9, max(5, len(plot_df) * 0.55)))
    sns.barplot(data=plot_df, y="theme", x="count", color="#0EA5E9", ax=ax)
    for i, row in plot_df.iterrows():
        ax.text(row["count"] + 0.5, i, f'{int(row["count"])}', va="center")
    ax.set_title("开放题主题编码")
    ax.set_xlabel("提及次数（可多标签）")
    ax.set_ylabel("")
    fig.tight_layout()
    path = figure_path(paths, "fig_open_text_themes")
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    return coded, theme_table, path


def identity_appendix(df: pd.DataFrame, config: dict[str, Any], paths: OutputPaths) -> pd.DataFrame:
    identity_col = col(config, "identity_ambiguous")
    age_col = col(config, "age")
    table = pd.crosstab(df[identity_col], df[age_col]).reindex(columns=config["age_order"], fill_value=0)
    table["total"] = table.sum(axis=1)
    table = table.sort_values("total", ascending=False).reset_index()
    save_table(table, paths, "appendix_identity_ambiguous_by_age")
    return table


def add_school_work_status(df: pd.DataFrame, config: dict[str, Any]) -> pd.DataFrame:
    status_config = config["school_work_status"]
    identity_col = col(config, "identity_ambiguous")
    age_col = col(config, "age")
    status_col = status_config["status_column"]
    rule_col = status_config["rule_column"]
    unclassified = status_config["labels"]["unclassified"]

    def classify(row: pd.Series) -> tuple[str, str]:
        age = row[age_col]
        identity = option_code(row[identity_col])
        for rule in status_config["rules"]:
            if age in rule["ages"] and identity in rule["identity_codes"]:
                return rule["status"], rule["rule"]
        return unclassified, "未命中规则"

    out = df.copy()
    classified = out.apply(classify, axis=1, result_type="expand")
    out[status_col] = classified[0]
    out[rule_col] = classified[1]
    return out


def school_work_status_tables(df: pd.DataFrame, config: dict[str, Any], paths: OutputPaths) -> pd.DataFrame:
    status_config = config["school_work_status"]
    status_col = status_config["status_column"]
    rule_col = status_config["rule_column"]
    identity_col = col(config, "identity_ambiguous")
    age_col = col(config, "age")
    classifiable_statuses = status_config["classifiable_statuses"]

    counts = df[status_col].value_counts()
    classifiable_n = int(counts.reindex(classifiable_statuses, fill_value=0).sum())
    rows: list[dict[str, Any]] = []
    seen_statuses = set()
    for status in status_config["summary_order"]:
        count = int(counts.get(status, 0))
        seen_statuses.add(status)
        rows.append(
            {
                "school_work_status": status,
                "count": count,
                "pct_of_total": pct(count, len(df)),
                "pct_of_classifiable": pct(count, classifiable_n) if status in classifiable_statuses else "",
            }
        )
    for status, count in counts.items():
        if status in seen_statuses:
            continue
        rows.append(
            {
                "school_work_status": status,
                "count": int(count),
                "pct_of_total": pct(int(count), len(df)),
                "pct_of_classifiable": "",
            }
        )
    summary = pd.DataFrame(rows)
    save_table(summary, paths, "school_work_status_summary")

    detail = df[[age_col, identity_col, status_col, rule_col]].copy()
    detail["identity_code"] = detail[identity_col].map(option_code)
    detail["identity_label"] = detail[identity_col].map(clean_option_label)
    detail = (
        detail.groupby([age_col, "identity_code", "identity_label", status_col, rule_col], dropna=False)
        .size()
        .reset_index(name="count")
    )
    detail["age_sort"] = pd.Categorical(detail[age_col], categories=config["age_order"], ordered=True)
    detail = detail.sort_values(["age_sort", "identity_code", status_col]).drop(columns=["age_sort"])
    detail = detail.rename(columns={age_col: "age_group", status_col: "school_work_status", rule_col: "school_work_rule"})
    save_table(detail, paths, "school_work_status_by_age_identity")
    return summary


def core_processed_dataset(df: pd.DataFrame, config: dict[str, Any], paths: OutputPaths) -> Path:
    keys = [
        "answer_id",
        "start_time",
        "end_time",
        "duration_sec",
        "channel",
        "province",
        "city",
        "device",
        "os",
        "browser",
        "quality_result",
        "identity_ambiguous",
        "age",
        "ai_usage",
        "local_app_frequency",
        "most_tangled_scene",
        "tangled_state",
        "ai_butler_reaction",
        "proactive_mode",
        "group_outing_frequency",
        "group_dining_difficulty",
        "group_conflict_action",
        "group_recommendation_style",
        "explanation_preference",
        "self_check_most",
        "self_check_least",
        "fallback_preference",
        "attention_check",
        "long_term_memory",
        "group_memory",
        "open_text",
    ]
    columns = [col(config, key) for key in keys if col(config, key) in df.columns]
    derived_columns = [
        config["school_work_status"]["status_column"],
        config["school_work_status"]["rule_column"],
    ]
    out = df[columns + [column for column in derived_columns if column in df.columns]].copy()
    out.to_csv(paths.root / "processed_survey.csv", index=False, encoding="utf-8-sig")
    return paths.root / "processed_survey.csv"


def top_option(df: pd.DataFrame, column: str) -> tuple[str, int, float]:
    counts = value_counts_table(df, column, len(df))
    if counts.empty:
        return "", 0, 0.0
    row = counts.iloc[0]
    return str(row["option"]), int(row["count"]), float(row["pct"])


def single_choice_tables(df: pd.DataFrame, config: dict[str, Any], paths: OutputPaths) -> dict[str, pd.DataFrame]:
    tables = {}
    for key, spec in config["single_choice"].items():
        column = col(config, spec["column"])
        overall = value_counts_table(df, column, len(df))
        by_age = by_age_counts(df, column, col(config, "age"), config["age_order"])
        save_table(overall, paths, f"{key}_overall")
        save_table(by_age, paths, f"{key}_by_age")
        tables[key] = overall
    return tables


def write_metrics(
    df: pd.DataFrame,
    config: dict[str, Any],
    paths: OutputPaths,
    raw_columns: int,
    report_figures: dict[str, Path],
    theme_table: pd.DataFrame,
) -> dict[str, Any]:
    duration = pd.to_numeric(df[col(config, "duration_sec")], errors="coerce")
    school_work_status_col = config["school_work_status"]["status_column"]
    metrics = {
        "sample_size": int(len(df)),
        "column_count": int(raw_columns),
        "age_counts": value_counts_table(df, col(config, "age"), len(df)).to_dict(orient="records"),
        "school_work_status": value_counts_table(df, school_work_status_col, len(df)).to_dict(orient="records"),
        "duration": {
            "min": float(duration.min()),
            "median": float(duration.median()),
            "mean": float(duration.mean()),
            "max": float(duration.max()),
        },
        "quality_result": value_counts_table(df, col(config, "quality_result"), len(df)).to_dict(orient="records"),
        "attention_check": value_counts_table(df, col(config, "attention_check"), len(df)).to_dict(orient="records"),
        "figures": {
            key: str(path.resolve().relative_to((ROOT / "analysis").resolve())).replace("\\", "/")
            for key, path in report_figures.items()
        },
        "open_text_top_themes": theme_table.head(6).to_dict(orient="records"),
    }
    with (paths.root / "report_metrics.json").open("w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)
    return metrics


def relative_report_link(report_path: Path, asset: Path) -> str:
    return asset.resolve().relative_to(report_path.parent.resolve()).as_posix()


def generate_report(
    df: pd.DataFrame,
    config: dict[str, Any],
    paths: OutputPaths,
    report_path: Path,
    figures: dict[str, Path],
    single_tables: dict[str, pd.DataFrame],
    theme_table: pd.DataFrame,
    identity_table: pd.DataFrame,
    raw_columns: int,
) -> None:
    n = len(df)
    age_col = col(config, "age")
    duration = pd.to_numeric(df[col(config, "duration_sec")], errors="coerce")
    attention_top = top_option(df, col(config, "attention_check"))
    ai_reaction = value_counts_table(df, col(config, "ai_butler_reaction"), n)
    proactive = value_counts_table(df, col(config, "proactive_mode"), n)
    group_diff = value_counts_table(df, col(config, "group_dining_difficulty"), n)
    conflict_action = value_counts_table(df, col(config, "group_conflict_action"), n)
    explain = value_counts_table(df, col(config, "explanation_preference"), n)
    memory = value_counts_table(df, col(config, "long_term_memory"), n)
    group_memory = value_counts_table(df, col(config, "group_memory"), n)

    def fig_md(key: str, alt: str) -> str:
        return f"![{alt}]({relative_report_link(report_path, figures[key])})"

    def opt_line(table: pd.DataFrame, limit: int = 3) -> str:
        parts = []
        for _, row in table.head(limit).iterrows():
            parts.append(f"{clean_option_label(row['option'])} {int(row['count'])} 人（{row['pct']}%）")
        return "；".join(parts)

    age_counts = value_counts_table(df, age_col, n)
    age_line = opt_line(age_counts, 4)
    ai_try_count = int(ai_reaction[ai_reaction["option"].str.startswith(("A.", "B."), na=False)]["count"].sum())
    ai_try_pct = pct(ai_try_count, n)
    proactive_ok_count = int(proactive[proactive["option"].str.startswith(("B.", "C."), na=False)]["count"].sum())
    proactive_ok_pct = pct(proactive_ok_count, n)
    difficulty_count = int(group_diff[group_diff["option"].str.startswith(("A.", "B."), na=False)]["count"].sum())
    difficulty_pct = pct(difficulty_count, n)
    ai_compromise_count = int(conflict_action[conflict_action["option"].str.startswith("A.", na=False)]["count"].sum())
    ai_compromise_pct = pct(ai_compromise_count, n)
    explain_count = int(explain[explain["option"].str.startswith(("A.", "B."), na=False)]["count"].sum())
    explain_pct = pct(explain_count, n)
    memory_positive = int(memory[memory["option"].str.startswith(("A.", "B."), na=False)]["count"].sum())
    memory_positive_pct = pct(memory_positive, n)

    top_pain = pd.read_csv(table_path(paths, "decision_pain_points_overall"), encoding="utf-8-sig")
    top_conflicts = pd.read_csv(table_path(paths, "group_conflict_types_overall"), encoding="utf-8-sig")
    top_tasks = pd.read_csv(table_path(paths, "desired_ai_tasks_overall"), encoding="utf-8-sig")
    ranking = pd.read_csv(table_path(paths, "priority_scenario_ranking_overall"), encoding="utf-8-sig")
    funnel = pd.read_csv(table_path(paths, "group_dining_funnel"), encoding="utf-8-sig")
    self_check = pd.read_csv(table_path(paths, "self_check_most_vs_least"), encoding="utf-8-sig")
    concerns = pd.read_csv(table_path(paths, "concerns_overall"), encoding="utf-8-sig")
    school_work = pd.read_csv(table_path(paths, "school_work_status_summary"), encoding="utf-8-sig")

    status_labels = config["school_work_status"]["labels"]

    def status_count(status: str) -> int:
        matching = school_work[school_work["school_work_status"] == status]
        return int(matching.iloc[0]["count"]) if not matching.empty else 0

    school_count = status_count(status_labels["school"])
    work_count = status_count(status_labels["work"])
    excluded_count = status_count(status_labels["excluded"])
    classifiable_count = school_count + work_count

    report = f"""# AI 管家问卷分析报告：按年龄段分组

> 本报告由 `analysis/scripts/analyze_survey.py` 自动生成。总体和年龄段主分析使用全样本；只有“在校/已工作”对比使用临时派生字段。

## 1. 数据说明与质量概览

- 样本量：`{n}` 条，原始字段 `{raw_columns}` 列；Credamo 双表头已自动识别，实际数据从第三行开始。
- 统计口径：总体和年龄段图表使用全样本 `{n}`；涉及“在校/已工作”的图表和结论才使用 `school_work_status` 派生字段。
- 在校/已工作派生口径：可分样本 `{classifiable_count}` 人，其中在校 `{school_count}` 人、已工作 `{work_count}` 人；边界模糊 `{excluded_count}` 人不进入该分组统计分母。
- 年龄结构：{age_line}。
- 作答时长：中位数 `{duration.median():.0f}` 秒，均值 `{duration.mean():.0f}` 秒，范围 `{duration.min():.0f}-{duration.max():.0f}` 秒。
- 注意力题：`{attention_top[0]}` 为 `{attention_top[1]}` 人（{attention_top[2]}%），当前批次按高质量真实样本处理。
- 质检结果仅做透明展示，不作为当前批次剔除规则。

{fig_md("age_distribution", "年龄段样本分布")}

{fig_md("duration", "作答总时长分布")}

## 2. 年龄段用户画像

这批样本的用户基础很适合验证“本地生活 AI 管家”：AI 使用频率和本地生活 App 使用频率都较高，说明他们既有 AI 心智，也有高频本地生活决策场景。

- AI 使用：{opt_line(single_tables["ai_usage"], 3)}。
- 本地生活 App 使用：{opt_line(single_tables["local_app_frequency"], 3)}。
- 对 AI 管家的第一反应：愿意主动尝试或看到后试试共 `{ai_try_count}` 人（{ai_try_pct}%）。

{fig_md("ai_usage", "AI 工具使用频率按年龄段对比")}

{fig_md("local_app_frequency", "本地生活 App 使用频率按年龄段对比")}

## 3. 本地生活决策痛点

痛点不是“没有信息”，而是信息太多、跨平台比较成本高、真假评价难辨，并且具体到吃饭/约饭场景时会变成选择和协调负担。

- 最容易纠结的场景：{opt_line(single_tables["most_tangled_scene"], 4)}。
- 决策状态：{opt_line(single_tables["tangled_state"], 4)}。
- 多选痛点 Top 3：{'; '.join([f"{row['option']} {int(row['count'])} 人（{row['pct']}%）" for _, row in top_pain.head(3).iterrows()])}。

{fig_md("most_tangled_scene", "最容易纠结的场景按年龄段对比")}

{fig_md("decision_pain_points", "本地生活决策痛点按年龄段对比")}

## 4. 多人约饭为什么值得做主场景

多人约饭符合高频、痛点明确、适合展示管家能力三个条件：它不仅需要推荐，还需要收集偏好、识别冲突、解释折中。

- 遇到“经常/有时”约饭难定：`{difficulty_count}` 人（{difficulty_pct}%）。
- 约饭分歧时愿意尝试 AI 生成折中方案：`{ai_compromise_count}` 人（{ai_compromise_pct}%）。
- 希望 AI 说明“照顾了谁的偏好、牺牲了什么”：`{explain_count}` 人（{explain_pct}%）。
- 常见冲突 Top 3：{'; '.join([f"{row['option']} {int(row['count'])} 人（{row['pct']}%）" for _, row in top_conflicts.head(3).iterrows()])}。

{fig_md("group_dining_funnel", "多人约饭核心链路")}

{fig_md("group_conflict_types", "多人约饭冲突类型按年龄段对比")}

{fig_md("explanation_preference", "解释照顾/牺牲偏好按年龄段对比")}

## 5. AI 管家的接受度与主动边界

用户并不排斥主动性，但边界很明确：更偏好“合适时间出现、不要太频繁”，而不是无条件打扰。

- 接受主动提醒或两者都可但不频繁：`{proactive_ok_count}` 人（{proactive_ok_pct}%）。
- 用户最希望 AI 做的事 Top 3：{'; '.join([f"{row['option']} {int(row['count'])} 人（{row['pct']}%）" for _, row in top_tasks.head(3).iterrows()])}。
- 场景排序显示，“一个人吃什么”和“多人约饭/聚会”是最靠前的两个场景。

{fig_md("ai_butler_reaction", "AI 管家尝试意愿按年龄段对比")}

{fig_md("proactive_mode", "主动提醒接受边界按年龄段对比")}

{fig_md("desired_ai_tasks", "最希望 AI 管家帮忙做什么按年龄段对比")}

{fig_md("reminder_moments", "主动提醒时刻按年龄段对比")}

{fig_md("priority_ranking", "AI 管家优先场景排序热力图")}

## 6. 方案自检与信任机制

“靠谱”比“会说”更重要。用户在意 AI 是否能在推荐前检查关键约束，尤其是预算、排队、营业和多人需求是否被明显牺牲。

- 最看重的自检项：{'; '.join([f"{row['option']} {int(row['most_count'])} 人（{row['most_pct']}%）" for _, row in self_check.head(3).iterrows()])}。
- 如果方案不满足条件，用户更倾向于 AI 自动重新生成、直接说明问题或主动追问缺失信息。

{fig_md("self_check", "方案自检项最看重与最不看重对比")}

{fig_md("fallback_preference", "方案不满足条件时的处理偏好")}

## 7. 记忆偏好与隐私边界

记忆能力有价值，但必须给用户控制权。用户最能接受的是记录口味、忌口、预算、常见场景等对决策有直接帮助的信息。

- 非常/比较希望 AI 记住个人长期偏好：`{memory_positive}` 人（{memory_positive_pct}%）。
- 朋友/小团体偏好记录方式：{opt_line(group_memory, 3)}。
- 主要顾虑 Top 3：{'; '.join([f"{row['option']} {int(row['count'])} 人（{row['pct']}%）" for _, row in concerns.head(3).iterrows()])}。

{fig_md("memory_items", "可接受 AI 记住的信息按年龄段对比")}

{fig_md("concerns", "AI 管家顾虑按年龄段对比")}

## 8. 产品建议：主 Demo 应如何讲

1. 主 Demo 聚焦“多人约饭”，不要泛泛展示所有本地生活场景。
2. 输出方式建议是 `2-3 个方案 + 冲突识别 + 推荐理由 + 风险提示`，而不是直接给一个单点推荐。
3. 管家角色应该“主动但克制”：在饭点、周末前、方案变动时出现，但必须避免高频打扰。
4. 方案自检要显性展示：预算、距离、排队、营业、忌口/偏好牺牲都应成为推荐前检查项。
5. 记忆功能要有可查看、可修改、可删除的入口，特别是涉及朋友/小团体偏好时。

## 开放题主题

开放题共 `{len(df[df[col(config, "open_text")] != ""])}` 条有效文本。主题编码是规则辅助分类，可多标签，用于发现叙事素材而非严格统计推断。

{'; '.join([f"{row['theme']} {int(row['count'])} 次" for _, row in theme_table.head(5).iterrows()])}。

{fig_md("open_text_themes", "开放题主题编码")}

## 附录：第一题处理说明

“你的身份是？”这一题存在不可逆歧义：选项同时包含专科、本科生、研究生、博士生和已工作年限，部分被试可能按学历理解，部分按当前身份理解。因此本报告主分析不使用该题做核心分组，只在这里保留交叉分布供查阅。

身份/学历题按年龄段交叉表已输出到 `{relative_report_link(report_path, table_path(paths, "appendix_identity_ambiguous_by_age"))}`。

如后续需要比较“在校/已工作”，使用 `school_work_status` 临时派生口径：`18-22 岁 + 专科/本科生`、`23-26 岁 + 研究生/博士生`、`27-30 岁 + 博士生` 归为在校；明确已工作选项，以及 `27-30 岁/30 岁以上 + 专科/本科生/研究生` 归为已工作；`23-26 岁 + 专科/本科生` 和 `30 岁以上 + 博士生` 归为边界模糊并剔除出该分组统计。该规则只用于当前问卷歧义数据，后续新版问卷拆分“当前状态”和“最高学历/教育阶段”后应废弃。

在校/已工作派生统计已输出到 `{relative_report_link(report_path, table_path(paths, "school_work_status_summary"))}`；按年龄与身份/学历题的审计明细已输出到 `{relative_report_link(report_path, table_path(paths, "school_work_status_by_age_identity"))}`。
"""
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(report, encoding="utf-8")


def main() -> None:
    args = parse_args()
    config = load_config(args.config)
    paths = ensure_paths(args.output)
    setup_plot_style()

    df, raw_header, _short_header = read_credamo_csv(args.input, config["input_encoding"])
    age_col = col(config, "age")
    df = df[df[age_col].isin(config["age_order"])].copy()

    # Stable row order and numeric field cleanup for downstream checks.
    df[col(config, "duration_sec")] = pd.to_numeric(df[col(config, "duration_sec")], errors="coerce")
    df[col(config, "duration_sec")] = df[col(config, "duration_sec")].astype("Int64").astype(str).replace("<NA>", "")
    df = add_school_work_status(df, config)

    school_work_status_tables(df, config, paths)
    processed_path = core_processed_dataset(df, config, paths)
    single_tables = single_choice_tables(df, config, paths)

    figures: dict[str, Path] = {}
    figures["age_distribution"] = plot_age_distribution(df, config, paths)
    figures["duration"] = plot_duration(df, config, paths)
    figures["ai_usage"] = plot_stacked_by_age(df, config, paths, "ai_usage", "fig_ai_usage_by_age")
    figures["local_app_frequency"] = plot_stacked_by_age(
        df, config, paths, "local_app_frequency", "fig_local_app_frequency_by_age"
    )
    figures["most_tangled_scene"] = plot_stacked_by_age(
        df, config, paths, "most_tangled_scene", "fig_most_tangled_scene_by_age"
    )
    figures["ai_butler_reaction"] = plot_stacked_by_age(
        df, config, paths, "ai_butler_reaction", "fig_ai_butler_reaction_by_age"
    )
    figures["proactive_mode"] = plot_stacked_by_age(df, config, paths, "proactive_mode", "fig_proactive_mode_by_age")
    figures["explanation_preference"] = plot_stacked_by_age(
        df, config, paths, "explanation_preference", "fig_explanation_preference_by_age"
    )
    figures["fallback_preference"] = plot_stacked_by_age(
        df, config, paths, "fallback_preference", "fig_fallback_preference_by_age"
    )
    figures["decision_pain_points"] = plot_multi_by_age(
        df, config, paths, "decision_pain_points", "fig_decision_pain_points_by_age", table_name="decision_pain_points"
    )
    figures["desired_ai_tasks"] = plot_multi_by_age(
        df, config, paths, "desired_ai_tasks", "fig_desired_ai_tasks_by_age", table_name="desired_ai_tasks"
    )
    figures["reminder_moments"] = plot_multi_by_age(
        df, config, paths, "reminder_moments", "fig_reminder_moments_by_age", table_name="reminder_moments"
    )
    figures["group_conflict_types"] = plot_multi_by_age(
        df, config, paths, "group_conflict_types", "fig_group_conflict_types_by_age", table_name="group_conflict_types"
    )
    figures["memory_items"] = plot_multi_by_age(
        df, config, paths, "memory_items", "fig_memory_items_by_age", table_name="memory_items"
    )
    figures["concerns"] = plot_multi_by_age(df, config, paths, "concerns", "fig_concerns_by_age", table_name="concerns")
    figures["self_check"] = plot_self_check(df, config, paths)
    figures["priority_ranking"] = ranking_tables_and_plot(df, config, paths)
    figures["group_dining_funnel"] = plot_group_dining_funnel(df, config, paths)
    _coded, theme_table, figures["open_text_themes"] = code_open_text(df, config, paths)
    identity_table = identity_appendix(df, config, paths)

    metrics = write_metrics(df, config, paths, len(raw_header), figures, theme_table)
    generate_report(df, config, paths, args.report, figures, single_tables, theme_table, identity_table, len(raw_header))

    print(
        json.dumps(
            {
                "sample_size": metrics["sample_size"],
                "column_count": metrics["column_count"],
                "processed": str(processed_path),
                "report": str(args.report),
                "figures": len(list(paths.figures.glob("*.png"))),
                "tables": len(list(paths.tables.glob("*.csv"))),
                "output": str(paths.root),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
