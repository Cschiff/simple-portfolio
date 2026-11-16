(function () {
  "use strict";

  var STORAGE_KEY = "finance-portfolios-v1";
  var DEFAULT_TYPES = ["Cash", "Stocks", "Bonds", "Crypto", "Real Estate", "Other"];
  var DEFAULT_PLATFORMS = ["Binance", "Nexo", "Interactive Brokers"];
  var RISK_LEVELS = ["Low", "Medium", "High"];
  var TYPE_CLASS = {
    Cash: "type-cash",
    Stocks: "type-stocks",
    Bonds: "type-bonds",
    Crypto: "type-crypto",
    "Real Estate": "type-real-estate",
    Other: "type-other"
  };
  var RISK_BADGE = {
    Low: "risk-low",
    Medium: "risk-medium",
    High: "risk-high"
  };
  var RISK_BAR = {
    Low: "risk-bar-low",
    Medium: "risk-bar-medium",
    High: "risk-bar-high"
  };

  var els = {
    overview: document.getElementById("view-overview"),
    detail: document.getElementById("view-detail"),
    grandTotal: document.getElementById("grand-total"),
    overviewAllocations: document.getElementById("overview-allocations"),
    portfolioGrid: document.getElementById("portfolio-grid"),
    overviewEmpty: document.getElementById("overview-empty"),
    currencySelect: document.getElementById("currency-select"),
    importFile: document.getElementById("import-file"),
    portfolioName: document.getElementById("portfolio-name"),
    detailMeta: document.getElementById("detail-meta"),
    portfolioTotal: document.getElementById("portfolio-total"),
    detailAllocations: document.getElementById("detail-allocations"),
    assetTableBody: document.getElementById("asset-table-body"),
    assetsEmpty: document.getElementById("assets-empty"),
    assetDialog: document.getElementById("asset-dialog"),
    assetForm: document.getElementById("asset-form"),
    assetDialogTitle: document.getElementById("asset-dialog-title"),
    assetName: document.getElementById("asset-name"),
    assetPlatform: document.getElementById("asset-platform"),
    assetType: document.getElementById("asset-type"),
    assetRisk: document.getElementById("asset-risk"),
    assetValue: document.getElementById("asset-value"),
    assetPriceUrl: document.getElementById("asset-price-url"),
    newPlatformRow: document.getElementById("new-platform-row"),
    newPlatformName: document.getElementById("new-platform-name")
  };

  var state = loadState();
  var selectedPortfolioId = null;
  var editingAssetId = null;
  var inlineEdit = null;

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function defaultState() {
    return {
      version: 1,
      currency: "USD",
      assetTypes: DEFAULT_TYPES.slice(),
      platforms: DEFAULT_PLATFORMS.slice(),
      portfolios: []
    };
  }

  function isValidState(data) {
    if (!data || typeof data !== "object") return false;
    if (data.version !== 1) return false;
    if (!Array.isArray(data.portfolios)) return false;
    return data.portfolios.every(function (portfolio) {
      return (
        portfolio &&
        typeof portfolio === "object" &&
        typeof portfolio.id === "string" &&
        typeof portfolio.name === "string" &&
        Array.isArray(portfolio.assets) &&
        portfolio.assets.every(function (asset) {
          return (
            asset &&
            typeof asset === "object" &&
            typeof asset.id === "string" &&
            typeof asset.name === "string" &&
            typeof asset.type === "string" &&
            typeof asset.risk === "string" &&
            typeof asset.value === "number" &&
            isFinite(asset.value)
          );
        })
      );
    });
  }

  function normalizeState(data) {
    var next = defaultState();
    next.currency = typeof data.currency === "string" ? data.currency : "USD";
    next.assetTypes = Array.isArray(data.assetTypes) && data.assetTypes.length
      ? data.assetTypes.slice()
      : DEFAULT_TYPES.slice();
    next.platforms = mergePlatforms(data.platforms, data.portfolios);
    next.portfolios = data.portfolios.map(function (portfolio) {
      return {
        id: portfolio.id,
        name: portfolio.name,
        assets: portfolio.assets.map(function (asset) {
          return {
            id: asset.id,
            name: asset.name,
            platform: typeof asset.platform === "string" ? asset.platform : "",
            type: asset.type,
            risk: asset.risk,
            value: Number(asset.value),
            priceUrl: typeof asset.priceUrl === "string" ? asset.priceUrl : ""
          };
        })
      };
    });
    return next;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      if (!isValidState(parsed)) return defaultState();
      return normalizeState(parsed);
    } catch (err) {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function money(value) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: state.currency
      }).format(value || 0);
    } catch (err) {
      return (value || 0).toFixed(2) + " " + state.currency;
    }
  }

  function percent(part, total) {
    if (!total) return "—";
    return ((part / total) * 100).toFixed(1) + "%";
  }

  function sumAssets(assets) {
    return assets.reduce(function (total, asset) {
      return total + (Number(asset.value) || 0);
    }, 0);
  }

  function grandTotal() {
    return state.portfolios.reduce(function (total, portfolio) {
      return total + sumAssets(portfolio.assets);
    }, 0);
  }

  function allAssets() {
    return state.portfolios.reduce(function (list, portfolio) {
      return list.concat(portfolio.assets);
    }, []);
  }

  function addUniquePlatform(list, seen, name) {
    name = (name || "").trim();
    var key = name.toLowerCase();
    if (!name || seen[key]) return;
    seen[key] = true;
    list.push(name);
  }

  function mergePlatforms(saved, portfolios) {
    var list = [];
    var seen = {};
    DEFAULT_PLATFORMS.forEach(function (name) {
      addUniquePlatform(list, seen, name);
    });
    (Array.isArray(saved) ? saved : []).forEach(function (name) {
      addUniquePlatform(list, seen, name);
    });
    (Array.isArray(portfolios) ? portfolios : []).forEach(function (portfolio) {
      (portfolio.assets || []).forEach(function (asset) {
        addUniquePlatform(list, seen, asset.platform);
      });
    });
    return list;
  }

  function allPlatforms() {
    return mergePlatforms(state.platforms, state.portfolios);
  }

  function knownPlatforms() {
    return allPlatforms();
  }

  function platformClass(label) {
    var palette = ["type-cash", "type-stocks", "type-bonds", "type-crypto", "type-real-estate", "type-other"];
    var hash = 0;
    var text = label || "";
    for (var i = 0; i < text.length; i++) {
      hash = (hash + text.charCodeAt(i) * (i + 1)) % palette.length;
    }
    return palette[hash];
  }

  function allocation(assets, key, order) {
    var total = sumAssets(assets);
    var map = {};
    assets.forEach(function (asset) {
      var group = asset[key];
      if (key === "platform") {
        group = (group || "").trim() || "Unspecified";
      }
      map[group] = (map[group] || 0) + (Number(asset.value) || 0);
    });
    return order
      .filter(function (label) {
        return map[label];
      })
      .concat(
        Object.keys(map).filter(function (label) {
          return order.indexOf(label) === -1;
        })
      )
      .map(function (label) {
        return {
          label: label,
          value: map[label],
          share: total ? (map[label] / total) * 100 : 0
        };
      });
  }

  function typeClass(label) {
    return TYPE_CLASS[label] || "type-other";
  }

  function findPortfolio(id) {
    return state.portfolios.find(function (portfolio) {
      return portfolio.id === id;
    });
  }

  function renderAllocations(target, assets) {
    var typeItems = allocation(assets, "type", state.assetTypes);
    var riskItems = allocation(assets, "risk", RISK_LEVELS);
    var platformItems = allocation(assets, "platform", knownPlatforms().concat(["Unspecified"]));
    target.innerHTML =
      allocationCard("By type", typeItems, typeClass) +
      allocationCard("By platform", platformItems, platformClass) +
      allocationCard("By risk", riskItems, function (label) {
        return RISK_BAR[label] || "type-other";
      });
  }

  function allocationCard(title, items, classFor) {
    var bar = items
      .map(function (item) {
        return (
          '<span class="' +
          classFor(item.label) +
          '" style="width:' +
          item.share +
          '%" title="' +
          escapeHtml(item.label) +
          '"></span>'
        );
      })
      .join("");
    var legend = items.length
      ? items
          .map(function (item) {
            return (
              "<span><i class=\"swatch " +
              classFor(item.label) +
              "\"></i>" +
              escapeHtml(item.label) +
              " " +
              item.share.toFixed(0) +
              "% · " +
              money(item.value) +
              "</span>"
            );
          })
          .join("")
      : "<span>No values yet</span>";
    return (
      '<article class="allocation-card"><h3>' +
      title +
      '</h3><div class="bar">' +
      bar +
      '</div><div class="legend">' +
      legend +
      "</div></article>"
    );
  }

  function normalizePriceUrl(value) {
    var url = (value || "").trim();
    if (!url) return "";
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
      url = "https://" + url;
    }
    try {
      var parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
      return parsed.href;
    } catch (err) {
      return "";
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    els.currencySelect.value = state.currency;
    if (selectedPortfolioId && findPortfolio(selectedPortfolioId)) {
      renderDetail();
    } else {
      selectedPortfolioId = null;
      renderOverview();
    }
  }

  function renderOverview() {
    els.overview.hidden = false;
    els.detail.hidden = true;
    els.grandTotal.textContent = money(grandTotal());

    if (!state.portfolios.length) {
      els.overviewAllocations.hidden = true;
      els.portfolioGrid.innerHTML = "";
      els.overviewEmpty.hidden = false;
      return;
    }

    els.overviewEmpty.hidden = true;
    els.overviewAllocations.hidden = false;
    renderAllocations(els.overviewAllocations, allAssets());
    els.portfolioGrid.innerHTML = state.portfolios
      .map(function (portfolio) {
        var total = sumAssets(portfolio.assets);
        var typeItems = allocation(portfolio.assets, "type", state.assetTypes);
        var riskItems = allocation(portfolio.assets, "risk", RISK_LEVELS);
        return (
          '<button type="button" class="card" data-open="' +
          escapeHtml(portfolio.id) +
          '"><h2>' +
          escapeHtml(portfolio.name) +
          '</h2><p class="muted">' +
          portfolio.assets.length +
          (portfolio.assets.length === 1 ? " asset" : " assets") +
          '</p><p class="card-value">' +
          money(total) +
          '</p><div class="mini-bars">' +
          miniBar(typeItems, typeClass) +
          miniBar(riskItems, function (label) {
            return RISK_BAR[label] || "type-other";
          }) +
          "</div></button>"
        );
      })
      .join("");
  }

  function miniBar(items, classFor) {
    return (
      '<div class="bar">' +
      items
        .map(function (item) {
          return (
            '<span class="' +
            classFor(item.label) +
            '" style="width:' +
            item.share +
            '%"></span>'
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderDetail() {
    var portfolio = findPortfolio(selectedPortfolioId);
    if (!portfolio) return;

    els.overview.hidden = true;
    els.detail.hidden = false;

    if (document.activeElement !== els.portfolioName) {
      els.portfolioName.value = portfolio.name;
    }

    var total = sumAssets(portfolio.assets);
    els.detailMeta.textContent =
      portfolio.assets.length +
      (portfolio.assets.length === 1 ? " asset" : " assets");
    els.portfolioTotal.textContent = money(total);
    renderAllocations(els.detailAllocations, portfolio.assets);

    els.assetsEmpty.hidden = portfolio.assets.length > 0;
    els.assetTableBody.innerHTML = portfolio.assets
      .map(function (asset) {
        var isEditing =
          inlineEdit &&
          inlineEdit.portfolioId === portfolio.id &&
          inlineEdit.assetId === asset.id;
        var valueCell = isEditing
          ? '<input class="value-input" data-inline-value="' +
            escapeHtml(asset.id) +
            '" type="number" min="0" step="0.01" value="' +
            asset.value +
            '">'
          : '<button type="button" class="value-btn" data-edit-value="' +
            escapeHtml(asset.id) +
            '">' +
            money(asset.value) +
            "</button>";
        return (
          "<tr>" +
          "<td>" +
          escapeHtml(asset.name) +
          (asset.priceUrl
            ? ' <a class="price-link" href="' +
              escapeHtml(asset.priceUrl) +
              '" target="_blank" rel="noopener noreferrer">Price</a>'
            : "") +
          "</td>" +
          "<td>" +
          escapeHtml((asset.platform || "").trim() || "—") +
          "</td>" +
          "<td>" +
          escapeHtml(asset.type) +
          "</td>" +
          '<td><span class="badge ' +
          (RISK_BADGE[asset.risk] || "") +
          '">' +
          escapeHtml(asset.risk) +
          "</span></td>" +
          '<td class="num">' +
          valueCell +
          "</td>" +
          '<td class="num">' +
          percent(asset.value, total) +
          "</td>" +
          '<td class="actions-col">' +
          '<button type="button" class="btn btn-link" data-edit-asset="' +
          escapeHtml(asset.id) +
          '">Edit</button>' +
          '<button type="button" class="btn btn-link" data-delete-asset="' +
          escapeHtml(asset.id) +
          '">Delete</button>' +
          "</td></tr>"
        );
      })
      .join("");

    if (inlineEdit) {
      var input = els.assetTableBody.querySelector("[data-inline-value]");
      if (input) {
        input.focus();
        input.select();
      }
    }
  }

  function fillAssetSelects() {
    var currentType = els.assetType.value;
    var currentRisk = els.assetRisk.value;
    var currentPlatform = els.assetPlatform.value;
    els.assetType.innerHTML = state.assetTypes
      .map(function (type) {
        return "<option value=\"" + escapeHtml(type) + "\">" + escapeHtml(type) + "</option>";
      })
      .join("");
    els.assetRisk.innerHTML = RISK_LEVELS.map(function (risk) {
      return "<option value=\"" + escapeHtml(risk) + "\">" + escapeHtml(risk) + "</option>";
    }).join("");
    var platforms = allPlatforms();
    els.assetPlatform.innerHTML =
      '<option value="" disabled>Select a platform</option>' +
      platforms
        .map(function (platform) {
          return "<option value=\"" + escapeHtml(platform) + "\">" + escapeHtml(platform) + "</option>";
        })
        .join("");
    if (currentType) els.assetType.value = currentType;
    if (currentRisk) els.assetRisk.value = currentRisk;
    if (currentPlatform) els.assetPlatform.value = currentPlatform;
  }

  function hideNewPlatformRow() {
    els.newPlatformRow.hidden = true;
    els.newPlatformName.value = "";
  }

  function saveNewPlatform() {
    var name = els.newPlatformName.value.trim();
    if (!name) {
      els.newPlatformName.focus();
      return;
    }
    var existing = allPlatforms().find(function (platform) {
      return platform.toLowerCase() === name.toLowerCase();
    });
    if (existing) {
      fillAssetSelects();
      els.assetPlatform.value = existing;
    } else {
      state.platforms.push(name);
      saveState();
      fillAssetSelects();
      els.assetPlatform.value = name;
    }
    hideNewPlatformRow();
  }

  function addPortfolio() {
    var portfolio = {
      id: uid(),
      name: "Untitled portfolio",
      assets: []
    };
    state.portfolios.push(portfolio);
    selectedPortfolioId = portfolio.id;
    saveState();
    render();
    els.portfolioName.focus();
    els.portfolioName.select();
  }

  function deleteSelectedPortfolio() {
    var portfolio = findPortfolio(selectedPortfolioId);
    if (!portfolio) return;
    if (!confirm("Delete \"" + portfolio.name + "\" and all of its assets?")) return;
    state.portfolios = state.portfolios.filter(function (item) {
      return item.id !== portfolio.id;
    });
    selectedPortfolioId = null;
    saveState();
    render();
  }

  function openAssetDialog(assetId) {
    var portfolio = findPortfolio(selectedPortfolioId);
    if (!portfolio) return;
    fillAssetSelects();
    editingAssetId = assetId || null;
    var asset = assetId
      ? portfolio.assets.find(function (item) {
          return item.id === assetId;
        })
      : null;
    els.assetDialogTitle.textContent = asset ? "Edit asset" : "Add asset";
    els.assetName.value = asset ? asset.name : "";
    els.assetPlatform.value = asset && asset.platform ? asset.platform : "";
    els.assetType.value = asset ? asset.type : state.assetTypes[0];
    els.assetRisk.value = asset ? asset.risk : "Medium";
    els.assetValue.value = asset ? asset.value : "";
    els.assetPriceUrl.value = asset ? asset.priceUrl || "" : "";
    hideNewPlatformRow();
    els.assetDialog.showModal();
    els.assetName.focus();
  }

  function saveAsset(event) {
    event.preventDefault();
    var portfolio = findPortfolio(selectedPortfolioId);
    if (!portfolio) return;
    var value = Number(els.assetValue.value);
    if (!isFinite(value) || value < 0) return;

    var rawUrl = els.assetPriceUrl.value.trim();
    var priceUrl = normalizePriceUrl(rawUrl);
    if (rawUrl && !priceUrl) {
      alert("Enter a valid http or https price link.");
      els.assetPriceUrl.focus();
      return;
    }

    var payload = {
      name: els.assetName.value.trim(),
      platform: els.assetPlatform.value.trim(),
      type: els.assetType.value,
      risk: els.assetRisk.value,
      value: value,
      priceUrl: priceUrl
    };
    if (!payload.name || !payload.platform) return;

    if (editingAssetId) {
      var existing = portfolio.assets.find(function (asset) {
        return asset.id === editingAssetId;
      });
      if (existing) {
        existing.name = payload.name;
        existing.platform = payload.platform;
        existing.type = payload.type;
        existing.risk = payload.risk;
        existing.value = payload.value;
        existing.priceUrl = payload.priceUrl;
      }
    } else {
      portfolio.assets.push({
        id: uid(),
        name: payload.name,
        platform: payload.platform,
        type: payload.type,
        risk: payload.risk,
        value: payload.value,
        priceUrl: payload.priceUrl
      });
    }

    editingAssetId = null;
    els.assetDialog.close();
    saveState();
    render();
  }

  function deleteAsset(assetId) {
    var portfolio = findPortfolio(selectedPortfolioId);
    if (!portfolio) return;
    var asset = portfolio.assets.find(function (item) {
      return item.id === assetId;
    });
    if (!asset) return;
    if (!confirm("Delete \"" + asset.name + "\"?")) return;
    portfolio.assets = portfolio.assets.filter(function (item) {
      return item.id !== assetId;
    });
    saveState();
    render();
  }

  function commitInlineValue(input) {
    var portfolio = findPortfolio(selectedPortfolioId);
    if (!portfolio || !inlineEdit) return;
    var asset = portfolio.assets.find(function (item) {
      return item.id === inlineEdit.assetId;
    });
    inlineEdit = null;
    if (!asset) {
      render();
      return;
    }
    var value = Number(input.value);
    if (isFinite(value) && value >= 0) {
      asset.value = value;
      saveState();
    }
    render();
  }

  function exportJson() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    var stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = "portfolios-" + stamp + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function importJson(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (!isValidState(parsed)) {
          alert("That file is not a valid portfolio backup.");
          return;
        }
        if (!confirm("Replace all current portfolios with this backup?")) return;
        state = normalizeState(parsed);
        selectedPortfolioId = null;
        saveState();
        render();
      } catch (err) {
        alert("Could not read that JSON file.");
      }
    };
    reader.readAsText(file);
  }

  document.getElementById("btn-add-portfolio").addEventListener("click", addPortfolio);
  document.getElementById("btn-add-portfolio-empty").addEventListener("click", addPortfolio);
  document.getElementById("btn-back").addEventListener("click", function () {
    selectedPortfolioId = null;
    inlineEdit = null;
    render();
  });
  document.getElementById("btn-delete-portfolio").addEventListener("click", deleteSelectedPortfolio);
  document.getElementById("btn-add-asset").addEventListener("click", function () {
    openAssetDialog(null);
  });
  document.getElementById("btn-asset-cancel").addEventListener("click", function () {
    hideNewPlatformRow();
    els.assetDialog.close();
  });
  document.getElementById("btn-add-platform").addEventListener("click", function () {
    els.newPlatformRow.hidden = false;
    els.newPlatformName.focus();
  });
  document.getElementById("btn-save-platform").addEventListener("click", saveNewPlatform);
  els.newPlatformName.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      saveNewPlatform();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      hideNewPlatformRow();
    }
  });
  document.getElementById("btn-export").addEventListener("click", exportJson);
  document.getElementById("btn-import").addEventListener("click", function () {
    els.importFile.click();
  });
  els.importFile.addEventListener("change", function (event) {
    var file = event.target.files && event.target.files[0];
    importJson(file);
    event.target.value = "";
  });
  els.currencySelect.addEventListener("change", function () {
    state.currency = els.currencySelect.value;
    saveState();
    render();
  });
  els.assetForm.addEventListener("submit", saveAsset);
  els.portfolioName.addEventListener("change", function () {
    var portfolio = findPortfolio(selectedPortfolioId);
    if (!portfolio) return;
    var name = els.portfolioName.value.trim() || "Untitled portfolio";
    portfolio.name = name;
    els.portfolioName.value = name;
    saveState();
    render();
  });

  els.portfolioGrid.addEventListener("click", function (event) {
    var button = event.target.closest("[data-open]");
    if (!button) return;
    selectedPortfolioId = button.getAttribute("data-open");
    render();
  });

  els.assetTableBody.addEventListener("click", function (event) {
    var editValue = event.target.closest("[data-edit-value]");
    var editAsset = event.target.closest("[data-edit-asset]");
    var deleteBtn = event.target.closest("[data-delete-asset]");
    if (editValue) {
      inlineEdit = {
        portfolioId: selectedPortfolioId,
        assetId: editValue.getAttribute("data-edit-value")
      };
      render();
      return;
    }
    if (editAsset) {
      openAssetDialog(editAsset.getAttribute("data-edit-asset"));
      return;
    }
    if (deleteBtn) {
      deleteAsset(deleteBtn.getAttribute("data-delete-asset"));
    }
  });

  els.assetTableBody.addEventListener("keydown", function (event) {
    if (event.target.matches("[data-inline-value]") && event.key === "Enter") {
      event.preventDefault();
      commitInlineValue(event.target);
    }
    if (event.target.matches("[data-inline-value]") && event.key === "Escape") {
      inlineEdit = null;
      render();
    }
  });

  els.assetTableBody.addEventListener("focusout", function (event) {
    if (event.target.matches("[data-inline-value]")) {
      commitInlineValue(event.target);
    }
  });

  fillAssetSelects();
  render();
})();
