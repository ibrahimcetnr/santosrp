<script lang="ts">
  interface Props {
    name?: string;
    color?: string;
    size?: string | number;
    opacity?: number;
  }

  let {
    name = 'default',
    color = 'currentColor',
    size = '100%',
    opacity = 1
  }: Props = $props();

  const icons: Record<string, string> = {
    'map-pin': '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>',
    'clock': '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v6l4 2"></path>',
    'wallet': '<rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle>',

    'car-lights': '<path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M12 2a7 7 0 0 0-7 7c0 2 1 3.9 2.5 5.1C8.2 15 9 16.5 9 18h6c0-1.5.8-3 1.5-3.9C18 12.9 19 11 19 9a7 7 0 0 0-7-7z"></path>',
    'car-brake': '<circle cx="12" cy="12" r="10"></circle><path d="M10 15V9h2.5A1.5 1.5 0 0 1 14 10.5v0A1.5 1.5 0 0 1 12.5 12H10"></path>',
    'car-lock': '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>',
    'car-seatbelt': '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M15 2v6h-6V2z"></path><path d="M8 14l8-8"></path>',
    'gas-pump': '<path d="M3 22v-8c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v8"></path><path d="M11 12v-4c0-2.2-1.8-4-4-4h0c-2.2 0-4 1.8-4 4v4"></path><path d="M15 6h4a2 2 0 0 1 2 2v6l-4 4v4"></path>',

    'warning': '<path d="M12 9v4"></path><circle cx="12" cy="17" r="1"></circle><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>',
    'backpack': '<path d="M8 7V6a4 4 0 1 1 8 0v1"></path><rect x="5" y="7" width="14" height="14" rx="3"></rect><path d="M9 12h6"></path><path d="M9 15h6"></path>',
    'box': '<path d="M3 8l9-5 9 5-9 5-9-5z"></path><path d="M3 8v8l9 5 9-5V8"></path><path d="M12 13v8"></path>',
    'close': '<path d="M5 5l14 14"></path><path d="M19 5L5 19"></path>',
    'plus': '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
    'star': '<path d="M12 3l2.9 5.9 6.6 1-4.8 4.7 1.1 6.5L12 18l-5.8 3.1 1.1-6.5-4.8-4.7 6.6-1z"></path>',
    'users': '<circle cx="8" cy="8" r="3"></circle><path d="M2 18c0-3.3 2.7-6 6-6s6 2.7 6 6"></path><path d="M15 5.5a3 3 0 1 1 0 5"></path><path d="M22 18c0-3.3-2.3-5.5-5-5.8"></path>',
    'trash': '<path d="M5 6l1 13h12l1-13"></path><path d="M3 6h18"></path><path d="M9 6V3h6v3"></path>',
    'check': '<path d="M4 12l5 5 11-11"></path>',
    'x': '<path d="M6 6l12 12"></path><path d="M18 6L6 18"></path>',
    'faction-invite': '<path d="M12 2l2.5 5 5.5.8-4 3.9.9 5.5L12 14.8 7.1 17.2l.9-5.5-4-3.9 5.5-.8z"></path>',
    'trade': '<path d="M5 7h11"></path><path d="M13 4l3 3-3 3"></path><path d="M19 17H8"></path><path d="M11 14l-3 3 3 3"></path>',
    'taxi': '<path d="M5 14h14l-1.2-5a3 3 0 0 0-2.9-2.3H9.1A3 3 0 0 0 6.2 9L5 14z"></path><circle cx="8" cy="16" r="2"></circle><circle cx="16" cy="16" r="2"></circle><path d="M9 6l1-2h4l1 2"></path>',

    'water': '<path d="M12 3c3 4 5 6.5 5 9a5 5 0 1 1-10 0c0-2.5 2-5 5-9z"></path>',
    'burger': '<path d="M5 11h14"></path><path d="M4 14h16"></path><path d="M6 17h12"></path><path d="M7 9a5 5 0 0 1 10 0"></path>',
    'phone': '<rect x="7" y="2" width="10" height="20" rx="2"></rect><path d="M11 18h2"></path>',
    'pistol': '<path d="M3 10h11l4-2 3 1v3h-3v4h-4v-3H9v3H6v-3H3z"></path>',

    'default': '<circle cx="12" cy="12" r="9"></circle><path d="M9 9h6v6H9z"></path>'
  };

  const currentSvg = $derived(icons[name] ?? icons.default);
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  style="color: {color}; opacity: {opacity}; transition: all 0.2s ease;"
  xmlns="http://www.w3.org/2000/svg"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  {@html currentSvg}
</svg>
