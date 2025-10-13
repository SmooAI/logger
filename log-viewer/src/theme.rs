#![allow(dead_code)]
use eframe::egui::{self, Color32, Margin, Rounding, Stroke, Visuals};
use smooai_logger::Level;

/// Brand color palette derived from the Tailwind theme configuration.
pub mod smoo {
    use eframe::egui::Color32;

    pub const WHITE: Color32 = color(0xf8fafc);
    pub const DARK_BLUE: Color32 = color(0x020618);
    pub const GREEN: Color32 = color(0x00a6a6);
    pub const RED: Color32 = color(0xff6b6c);
    pub const ORANGE: Color32 = color(0xf49f0a);
    pub const BLUE: Color32 = color(0xbbdef0);
    pub const ROSE: Color32 = color(0xf0e2e7);

    pub const GRAY_50: Color32 = color(0xf3f3f3);
    pub const GRAY_100: Color32 = color(0xe8e8e8);
    pub const GRAY_200: Color32 = color(0xcfcfcf);
    pub const GRAY_300: Color32 = color(0xb9b9b9);
    pub const GRAY_400: Color32 = color(0xa3a3a3);
    pub const GRAY_500: Color32 = color(0x868686);
    pub const GRAY_600: Color32 = color(0x6a6a6a);
    pub const GRAY_700: Color32 = color(0x4e4e4e);
    pub const GRAY_800: Color32 = color(0x353535);
    pub const GRAY_900: Color32 = color(0x1d1d1d);
    pub const GRAY_950: Color32 = color(0x131313);

    pub const BLUE_400: Color32 = color(0x5fb1dc);
    pub const BLUE_700: Color32 = color(0x1a5878);

    pub const fn color(hex: u32) -> Color32 {
        let r = ((hex >> 16) & 0xff) as u8;
        let g = ((hex >> 8) & 0xff) as u8;
        let b = (hex & 0xff) as u8;
        Color32::from_rgb(r, g, b)
    }
}

#[derive(Clone, Copy)]
pub struct SmooTheme {
    pub background: Color32,
    pub foreground: Color32,
    pub primary: Color32,
    pub primary_fg: Color32,
    pub secondary: Color32,
    pub secondary_fg: Color32,
    pub accent: Color32,
    pub accent_fg: Color32,
    pub border: Color32,
    pub input: Color32,
    pub ring: Color32,
    pub muted: Color32,
    pub muted_fg: Color32,
    pub destructive: Color32,
    pub destructive_fg: Color32,
}

pub fn light_theme() -> SmooTheme {
    SmooTheme {
        background: smoo::WHITE,
        foreground: smoo::DARK_BLUE,
        primary: smoo::GREEN,
        primary_fg: smoo::WHITE,
        secondary: smoo::RED,
        secondary_fg: smoo::WHITE,
        accent: smoo::ORANGE,
        accent_fg: smoo::WHITE,
        border: smoo::BLUE_400,
        input: smoo::BLUE_700,
        ring: smoo::BLUE_400,
        muted: smoo::BLUE,
        muted_fg: smoo::GRAY_400,
        destructive: smoo::color(0x8b1d1d),
        destructive_fg: smoo::WHITE,
    }
}

pub fn dark_theme() -> SmooTheme {
    SmooTheme {
        background: smoo::DARK_BLUE,
        foreground: smoo::WHITE,
        primary: smoo::GREEN,
        primary_fg: smoo::WHITE,
        secondary: smoo::RED,
        secondary_fg: smoo::WHITE,
        accent: smoo::ORANGE,
        accent_fg: smoo::WHITE,
        border: smoo::BLUE_400,
        input: smoo::BLUE_700,
        ring: smoo::BLUE_400,
        muted: smoo::BLUE,
        muted_fg: smoo::GRAY_400,
        destructive: smoo::color(0x8b1d1d),
        destructive_fg: smoo::WHITE,
    }
}

pub fn apply_visuals(ctx: &egui::Context, dark: bool) {
    let theme = if dark { dark_theme() } else { light_theme() };

    let mut visuals = if dark {
        Visuals::dark()
    } else {
        Visuals::light()
    };
    visuals.extreme_bg_color = theme.background;
    visuals.faint_bg_color = stripe_background(dark);
    visuals.panel_fill = theme.background;
    visuals.window_fill = theme.background;
    visuals.override_text_color = Some(theme.foreground);
    visuals.selection.bg_fill = selection_background(dark);
    visuals.selection.stroke = Stroke {
        width: 1.0,
        color: theme.border,
    };
    visuals.hyperlink_color = theme.primary;

    let rounding = Rounding::same(8.0);
    visuals.widgets.noninteractive.rounding = rounding;
    visuals.widgets.inactive.rounding = rounding;
    visuals.widgets.hovered.rounding = rounding;
    visuals.widgets.active.rounding = rounding;
    visuals.widgets.open.rounding = rounding;

    visuals.window_stroke = Stroke {
        width: 1.0,
        color: theme.border,
    };
    visuals.widgets.noninteractive.bg_fill = theme.background;
    visuals.widgets.inactive.bg_fill = lerp(theme.background, theme.muted, 0.05);
    visuals.widgets.hovered.bg_fill = lerp(theme.background, theme.muted, 0.10);
    visuals.widgets.active.bg_fill = lerp(theme.background, theme.muted, 0.15);

    ctx.set_visuals(visuals.clone());

    let mut style = (*ctx.style()).clone();
    style.visuals = visuals;
    style.spacing.item_spacing = egui::vec2(8.0, 6.0);
    style.spacing.window_margin = Margin::same(12.0);
    style.visuals.window_rounding = rounding;
    ctx.set_style(style);
}

pub fn stripe_background(dark: bool) -> Color32 {
    let theme = if dark { dark_theme() } else { light_theme() };
    lerp(
        theme.background,
        theme.muted,
        if dark { 0.14 } else { 0.08 },
    )
}

pub fn selection_background(dark: bool) -> Color32 {
    let theme = if dark { dark_theme() } else { light_theme() };
    lerp(theme.ring, theme.background, if dark { 0.45 } else { 0.6 })
}

pub fn header_background(dark: bool) -> Color32 {
    let theme = if dark { dark_theme() } else { light_theme() };
    lerp(
        theme.background,
        theme.muted,
        if dark { 0.12 } else { 0.10 },
    )
}

pub fn grid_stroke(dark: bool) -> Stroke {
    let color = if dark {
        lerp(smoo::GRAY_800, smoo::GRAY_600, 0.35)
    } else {
        lerp(smoo::GRAY_100, smoo::GRAY_300, 0.45)
    };
    Stroke { width: 1.0, color }
}

pub fn level_color(level: &str) -> Color32 {
    match Level::parse_level(level) {
        Some(Level::Error) | Some(Level::Fatal) => smoo::RED,
        Some(Level::Warn) => smoo::ORANGE,
        Some(Level::Info) => smoo::BLUE_400,
        Some(Level::Debug) => smoo::GRAY_500,
        Some(Level::Trace) => smoo::GRAY_400,
        _ => smoo::GRAY_400,
    }
}

pub fn lerp(a: Color32, b: Color32, t: f32) -> Color32 {
    let to_f = |c: Color32| (c.r() as f32, c.g() as f32, c.b() as f32);
    let (ar, ag, ab) = to_f(a);
    let (br, bg, bb) = to_f(b);
    Color32::from_rgb(
        ((1.0 - t) * ar + t * br) as u8,
        ((1.0 - t) * ag + t * bg) as u8,
        ((1.0 - t) * ab + t * bb) as u8,
    )
}
