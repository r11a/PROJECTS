export const priorityClassifications = [
  ["equipment", "ציוד"],
  ["material", "חומר"],
  ["installation_day", "יום התקנה"],
  ["programming_day", "יום תכנות"],
  ["service", "שירות"],
  ["description", "שורת תיאור"],
  ["ignore", "התעלמות"],
];

export const classificationLabel = (value) =>
  priorityClassifications.find(([key]) => key === value)?.[1] || value;

export const priorityMoney = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 2,
});

export function preparePriorityLines(lines = []) {
  return lines.map((line) => ({
    ...line,
    catalogItemId: line.catalogItem?.id || "",
    projectSystemId: line.catalogItem?.parentId || "",
    createCatalogItem: false,
    manufacturer: line.manufacturer || line.catalogItem?.manufacturer || "",
    model: line.model || line.catalogItem?.model || "",
  }));
}

export function priorityHours(lines = []) {
  return lines.reduce(
    (total, line) => {
      if (!line.include || !line.includeInReferenceHours) return total;
      const hours = Math.max(0, Number(line.quantity) || 0) * 8;
      if (line.classification === "installation_day") total.installation += hours;
      if (line.classification === "programming_day") total.programming += hours;
      return total;
    },
    { installation: 0, programming: 0 },
  );
}

export function priorityReview(lines = []) {
  const selected = lines.filter((line) => line.include);
  return {
    total: lines.length,
    selected: selected.length,
    equipment: selected.filter((line) => line.includeInEquipment).length,
    newCatalog: selected.filter((line) => line.createCatalogItem).length,
    matched: selected.filter((line) => line.catalogItemId && !line.createCatalogItem).length,
    services: selected.filter((line) => ["service", "description"].includes(line.classification)).length,
  };
}
