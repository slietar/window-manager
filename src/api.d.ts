export {};


declare global {
  interface Window {
    getScreenDetails(): Promise<ScreenDetails>;
  }

  interface ScreenDetails {
    currentScreen: ScreenDetailed;
    screens: ScreenDetailed[];

    addEventListener(type: 'currentscreenchange', handler: (event: Event) => void): void;
    addEventListener(type: 'screenschange', handler: (event: Event) => void): void;
  }

  interface ScreenDetailed extends Screen {
    devicePixelRatio: number;
    label: string;

    left: number;
    top: number;

    isExtended: boolean;
    isInternal: boolean;
    isPrimary: boolean;
  }
}
