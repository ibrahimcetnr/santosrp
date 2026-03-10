<script lang="ts">
  import { FactionType, getFactionTypeName, getFactionCategory } from '../../../shared/types';

  const GOLD = '#c9a84c';

  const DEFAULT_FACTION = {
    id: 1,
    name: 'Los Santos Polis Departmanı',
    founderName: 'James Morrison',
    type: FactionType.LAW_ENFORCEMENT,
    approvals: { isVerified: true, canHaveWeapons: true },
    stockValue: 125000,
    members: [
      { id: 1, name: 'James Morrison', rank: 5, division: 'Komutanlık' },
      { id: 2, name: 'Sarah Connor',   rank: 3, division: 'Trafik' },
      { id: 3, name: 'Michael Torres', rank: 2, division: 'Özel Harekat' },
    ],
    tasks:     [] as any[],
    ranks: [
      { id: 1, name: 'Stajyer',    salary: 500  },
      { id: 2, name: 'Memur',      salary: 1000 },
      { id: 3, name: 'Komiser',    salary: 2500 },
      { id: 4, name: 'Başkomiser', salary: 4000 },
      { id: 5, name: 'Komutan',    salary: 7500 },
    ],
    divisions: [
      { id: 1, name: 'Trafik' },
      { id: 2, name: 'Özel Harekat' },
      { id: 3, name: 'Komutanlık' },
    ],
    vehicles: [] as any[],
  };

  let {
    factionData = DEFAULT_FACTION,
    onClose = undefined,
    onInviteMember = undefined,
  }: {
    factionData?: any;
    onClose?: () => void;
    onInviteMember?: () => void;
  } = $props();

  let activeTab = $state('info');

  const isLegal   = $derived(getFactionCategory(factionData.type) === 'LEGAL');
  const category  = $derived(getFactionCategory(factionData.type));
  const typeName  = $derived(getFactionTypeName(factionData.type));

  const tabs = [
    { id: 'info',      label: 'Bilgiler',         icon: '◈' },
    { id: 'story',     label: 'Hikaye Ağacı',      icon: '◉' },
    { id: 'members',   label: 'Üyeler',            icon: '◎' },
    { id: 'ranks',     label: 'Rütbeler',          icon: '◇' },
    { id: 'divisions', label: 'Divizyonlar',       icon: '◈' },
    { id: 'vehicles',  label: 'Araçlar / Mülkler', icon: '◆' },
  ];

  function close() {
    if (onClose) onClose();
  }
</script>

<div class="panel">
  <!-- ── Sidebar ─────────────────────────────────────────── -->
  <aside class="sidebar">
    <div class="sidebar-brand">
      <div class="faction-avatar">
        {factionData.name[0]}
      </div>
      <div class="faction-meta">
        <span class="faction-title">{factionData.name}</span>
        <span class="faction-badge">{category}</span>
      </div>
    </div>

    <nav class="sidebar-nav">
      {#each tabs as tab}
        <button
          class="nav-btn"
          class:active={activeTab === tab.id}
          onclick={() => activeTab = tab.id}
        >
          <span class="nav-icon">{tab.icon}</span>
          {tab.label}
        </button>
      {/each}
    </nav>

    <button class="close-btn" onclick={close}>
      ✕ Kapat
    </button>
  </aside>

  <!-- ── Content ────────────────────────────────────────── -->
  <main class="content">

    <!-- BİLGİLER -->
    {#if activeTab === 'info'}
      <section class="tab-section">
        <h2 class="tab-title">Birlik Bilgileri</h2>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Birlik Adı</span>
            <span class="info-value">{factionData.name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Kurucu</span>
            <span class="info-value">{factionData.founderName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Birlik Tipi</span>
            <span class="info-value">
              <span class="category-tag">{category}</span>
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Birlik Türü</span>
            <span class="info-value">{typeName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Onaylar</span>
            <span class="info-value badges-wrap">
              {#if factionData.approvals.isVerified}
                <span class="badge badge-green">✓ Onaylı Birlik</span>
              {/if}
              {#if factionData.approvals.canHaveWeapons}
                <span class="badge badge-blue">⚔ Silah İzni</span>
              {/if}
              {#if !factionData.approvals.isVerified && !factionData.approvals.canHaveWeapons}
                <span class="badge badge-gray">Onay Yok</span>
              {/if}
            </span>
          </div>
          {#if isLegal}
            <div class="info-row">
              <span class="info-label">Hisse Değeri</span>
              <span class="info-value stock-value">
                ₺{factionData.stockValue.toLocaleString('tr-TR')}
              </span>
            </div>
          {/if}
        </div>
      </section>

    <!-- HİKAYE AĞACI -->
    {:else if activeTab === 'story'}
      <section class="tab-section">
        <h2 class="tab-title">Hikaye Ağacı</h2>
        <h3 class="sub-title">Görevler</h3>
        {#if factionData.tasks.length === 0}
          <div class="empty-state">
            <div class="empty-icon">◎</div>
            <span>Henüz aktif bir görev bulunmuyor.</span>
          </div>
        {:else}
          <div class="task-list">
            {#each factionData.tasks as task}
              <div class="task-row">{task.name}</div>
            {/each}
          </div>
        {/if}
      </section>

    <!-- ÜYELER -->
    {:else if activeTab === 'members'}
      <section class="tab-section">
        <h2 class="tab-title">Üyeler</h2>
        <div class="action-bar">
          <button class="btn btn-success" onclick={() => onInviteMember && onInviteMember()}>+ Üye Al</button>
        </div>

        <div class="member-list">
          {#if factionData.members.length === 0}
            <div class="empty-state">
              <div class="empty-icon">◎</div>
              <span>Kayıtlı üye bulunmuyor.</span>
            </div>
          {:else}
            <div class="list-header">
              <span>İsim</span>
              <span>Rütbe</span>
              <span>Divizyon</span>
            </div>
            {#each factionData.members as member}
              <div class="member-row">
                <span class="member-name">{member.name}</span>
                <span class="member-rank-tag">Rütbe {member.rank}</span>
                <span class="member-div">{member.division}</span>
              </div>
            {/each}
          {/if}
        </div>

        <div class="action-bar action-bar-bottom">
          <button class="btn btn-danger">✕ Üye At</button>
          <button class="btn btn-warning">✎ Rütbe Düzenle</button>
          <button class="btn btn-warning">⊕ Divizyon Düzenle</button>
        </div>
      </section>

    <!-- RÜTBELER -->
    {:else if activeTab === 'ranks'}
      <section class="tab-section">
        <h2 class="tab-title">Rütbeler</h2>
        <div class="action-bar">
          <button class="btn btn-primary">⊞ Rütbe Sayısı Belirle</button>
        </div>

        <div class="rank-list">
          {#each factionData.ranks as rank}
            <div class="rank-row">
              <span class="rank-num">{rank.id}</span>
              <input
                class="rank-name-input"
                type="text"
                value={rank.name}
                placeholder="Rütbe Adı"
              />
              <button class="btn btn-sm btn-outline">Yetkilendirme</button>
              {#if isLegal}
                <div class="salary-group">
                  <label class="salary-label" for="salary-{rank.id}">Maaş (₺)</label>
                  <input
                    id="salary-{rank.id}"
                    class="salary-input"
                    type="number"
                    value={rank.salary}
                    placeholder="0"
                    min="0"
                  />
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </section>

    <!-- DİVİZYONLAR -->
    {:else if activeTab === 'divisions'}
      <section class="tab-section">
        <h2 class="tab-title">Divizyonlar</h2>
        <div class="action-bar">
          <button class="btn btn-primary">⊞ Divizyon Sayısı</button>
        </div>

        <div class="division-list">
          {#each factionData.divisions as div}
            <div class="division-row">
              <span class="div-num">{div.id}</span>
              <input
                class="div-name-input"
                type="text"
                value={div.name}
                placeholder="Divizyon Adı"
              />
            </div>
          {/each}
        </div>
      </section>

    <!-- ARAÇLAR / MÜLKLER -->
    {:else if activeTab === 'vehicles'}
      <section class="tab-section">
        <h2 class="tab-title">Araç / Mülk Bilgileri</h2>
        {#if factionData.vehicles.length === 0}
          <div class="empty-state">
            <div class="empty-icon">◆</div>
            <span>Kayıtlı araç veya mülk bulunmuyor.</span>
          </div>
        {:else}
          <div class="vehicle-list">
            {#each factionData.vehicles as vehicle}
              <div class="vehicle-row">{vehicle.model}</div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

  </main>
</div>

<style>
  /* ── Panel Root ────────────────────────────────────────── */
  .panel {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 900px;
    height: 600px;
    background: rgba(10, 10, 18, 0.85);
    backdrop-filter: blur(12px) saturate(1.2);
    -webkit-backdrop-filter: blur(12px) saturate(1.2);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 16px;
    display: flex;
    overflow: hidden;
    box-shadow:
      0 32px 80px rgba(0, 0, 0, 0.75),
      0 0 0 1px rgba(201, 168, 76, 0.08);
    font-family: 'Segoe UI', 'Inter', sans-serif;
    color: #e2e2e8;
    user-select: none;
  }

  /* ── Sidebar ───────────────────────────────────────────── */
  .sidebar {
    width: 250px;
    min-width: 250px;
    background: rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
    border-right: 1px solid rgba(201, 168, 76, 0.12);
  }

  .sidebar-brand {
    padding: 20px 16px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid rgba(201, 168, 76, 0.1);
    min-height: 80px;
  }

  .faction-avatar {
    width: 44px;
    height: 44px;
    min-width: 44px;
    border-radius: 12px;
    border: 1px solid rgba(201, 168, 76, 0.4);
    background: rgba(201, 168, 76, 0.12);
    color: #c9a84c;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
  }

  .faction-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: hidden;
  }

  .faction-title {
    font-size: 12px;
    font-weight: 600;
    color: #d8cfa8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .faction-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 2px 8px;
    border-radius: 20px;
    text-transform: uppercase;
    width: fit-content;
    background: rgba(201, 168, 76, 0.15);
    color: #c9a84c;
    border: 1px solid rgba(201, 168, 76, 0.3);
  }

  /* ── Navigation ────────────────────────────────────────── */
  .sidebar-nav {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 10px 8px;
    gap: 2px;
    overflow-y: auto;
  }

  .nav-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-left: 2px solid transparent;
    border-radius: 8px;
    color: #7a7060;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .nav-btn:hover {
    background: rgba(201, 168, 76, 0.06);
    color: #c9a84c;
  }

  .nav-btn.active {
    background: rgba(201, 168, 76, 0.1);
    color: #c9a84c;
    font-weight: 600;
    border-left-color: #c9a84c;
    border-radius: 0 8px 8px 0;
  }

  .nav-icon {
    font-size: 11px;
    opacity: 0.7;
  }

  /* ── Close Button ──────────────────────────────────────── */
  .close-btn {
    margin: 8px 12px 14px;
    padding: 10px 16px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.22);
    border-radius: 10px;
    color: #f87171;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.03em;
    transition: background 0.15s, border-color 0.15s;
  }

  .close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.45);
  }

  /* ── Content Area ──────────────────────────────────────── */
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 28px 30px;
    scrollbar-width: thin;
    scrollbar-color: rgba(201, 168, 76, 0.2) transparent;
  }

  .content::-webkit-scrollbar { width: 4px; }
  .content::-webkit-scrollbar-track { background: transparent; }
  .content::-webkit-scrollbar-thumb { background: rgba(201, 168, 76, 0.2); border-radius: 4px; }

  .tab-section {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .tab-title {
    font-size: 18px;
    font-weight: 700;
    color: #e8dcb0;
    letter-spacing: -0.01em;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(201, 168, 76, 0.15);
    margin: 0;
  }

  .sub-title {
    font-size: 13px;
    font-weight: 600;
    color: #7a7060;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* ── Info Grid ─────────────────────────────────────────── */
  .info-grid {
    display: flex;
    flex-direction: column;
    gap: 1px;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.03);
  }

  .info-row {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.02);
    gap: 16px;
    transition: background 0.12s;
  }

  .info-row:hover {
    background: rgba(201, 168, 76, 0.05);
  }

  .info-label {
    width: 130px;
    min-width: 130px;
    font-size: 12px;
    font-weight: 600;
    color: #5a5040;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  .info-value {
    font-size: 14px;
    font-weight: 500;
    color: #d8d0b0;
    flex: 1;
  }

  .category-tag {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: rgba(201, 168, 76, 0.15);
    color: #c9a84c;
    border: 1px solid rgba(201, 168, 76, 0.3);
  }

  .badges-wrap {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .badge-green {
    background: rgba(201, 168, 76, 0.15);
    color: #c9a84c;
    border: 1px solid rgba(201, 168, 76, 0.3);
  }

  .badge-blue {
    background: rgba(201, 168, 76, 0.1);
    color: #d4b86a;
    border: 1px solid rgba(201, 168, 76, 0.2);
  }

  .badge-gray {
    background: rgba(255, 255, 255, 0.05);
    color: #7a7060;
    border: 1px solid rgba(255, 255, 255, 0.07);
  }

  .stock-value {
    font-size: 15px;
    font-weight: 700;
    color: #c9a84c;
    font-variant-numeric: tabular-nums;
  }

  /* ── Empty State ───────────────────────────────────────── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 20px;
    gap: 12px;
    color: #4a4030;
    font-size: 14px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
  }

  .empty-icon {
    font-size: 32px;
    opacity: 0.25;
    color: #c9a84c;
  }

  /* ── Action Bars ───────────────────────────────────────── */
  .action-bar {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .action-bar-bottom {
    margin-top: 4px;
    padding-top: 14px;
    border-top: 1px solid rgba(201, 168, 76, 0.1);
  }

  /* ── Buttons ───────────────────────────────────────────── */
  .btn {
    padding: 8px 18px;
    border-radius: 8px;
    border: 1px solid transparent;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.03em;
    transition: filter 0.15s, transform 0.1s;
  }

  .btn:hover { filter: brightness(1.15); }
  .btn:active { transform: scale(0.97); }

  /* Altın — birincil eylemler */
  .btn-success {
    background: rgba(201, 168, 76, 0.15);
    color: #c9a84c;
    border-color: rgba(201, 168, 76, 0.35);
  }

  /* Kırmızı — yalnızca yıkıcı işlemler */
  .btn-danger {
    background: rgba(239, 68, 68, 0.12);
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.28);
  }

  /* Turuncu-altın — düzenleme eylemleri */
  .btn-warning {
    background: rgba(201, 168, 76, 0.08);
    color: #c9a84c;
    border-color: rgba(201, 168, 76, 0.2);
  }

  /* Altın — nötr birincil */
  .btn-primary {
    background: rgba(201, 168, 76, 0.15);
    color: #c9a84c;
    border-color: rgba(201, 168, 76, 0.35);
  }

  .btn-sm {
    padding: 5px 12px;
    font-size: 11px;
    border-radius: 6px;
  }

  .btn-outline {
    background: transparent;
    border: 1px solid rgba(201, 168, 76, 0.2);
    color: #c9a84c;
  }

  .btn-outline:hover {
    background: rgba(201, 168, 76, 0.08);
  }

  /* ── Members ───────────────────────────────────────────── */
  .member-list {
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.02);
    gap: 1px;
  }

  .list-header {
    display: grid;
    grid-template-columns: 1fr 120px 140px;
    padding: 9px 14px;
    background: rgba(201, 168, 76, 0.06);
    font-size: 11px;
    font-weight: 700;
    color: #5a5040;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .member-row {
    display: grid;
    grid-template-columns: 1fr 120px 140px;
    align-items: center;
    padding: 11px 14px;
    background: rgba(255, 255, 255, 0.02);
    font-size: 13px;
    transition: background 0.12s;
  }

  .member-row:hover { background: rgba(201, 168, 76, 0.05); }

  .member-name { font-weight: 500; color: #d8d0b0; }

  .member-rank-tag {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(201, 168, 76, 0.1);
    color: #c9a84c;
    border: 1px solid rgba(201, 168, 76, 0.2);
    width: fit-content;
  }

  .member-div { color: #5a5040; font-size: 12px; }

  /* ── Ranks ─────────────────────────────────────────────── */
  .rank-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rank-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
    border: 1px solid rgba(201, 168, 76, 0.08);
  }

  .rank-num {
    width: 22px;
    height: 22px;
    min-width: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: rgba(201, 168, 76, 0.1);
    font-size: 11px;
    font-weight: 700;
    color: #c9a84c;
  }

  .rank-name-input,
  .salary-input,
  .div-name-input {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(201, 168, 76, 0.15);
    border-radius: 7px;
    color: #d8d0b0;
    font-size: 13px;
    padding: 6px 10px;
    outline: none;
    transition: border-color 0.15s;
  }

  .rank-name-input { flex: 1; }

  .rank-name-input:focus,
  .salary-input:focus,
  .div-name-input:focus {
    border-color: rgba(201, 168, 76, 0.45);
  }

  .salary-group {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: 8px;
  }

  .salary-label {
    font-size: 11px;
    font-weight: 600;
    color: #5a5040;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  .salary-input {
    width: 90px;
  }

  /* ── Divisions ─────────────────────────────────────────── */
  .division-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .division-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
    border: 1px solid rgba(201, 168, 76, 0.08);
  }

  .div-num {
    width: 22px;
    height: 22px;
    min-width: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: rgba(201, 168, 76, 0.1);
    font-size: 11px;
    font-weight: 700;
    color: #c9a84c;
  }

  .div-name-input { flex: 1; }
</style>
