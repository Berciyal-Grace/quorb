//! Identity is frozen from Tauri's build config, never selected by a runtime toggle.
use std::path::{Path, PathBuf};

pub struct Profile {
    pub identifier: &'static str,
    pub name: &'static str,
    pub home_dir: &'static str,
    pub migrate_legacy: bool,
}

pub const STABLE: Profile = Profile { identifier: "es.egdev.quorb", name: "Quorb", home_dir: ".quorb", migrate_legacy: true };
pub const DEV: Profile = Profile { identifier: "es.egdev.quorb.dev", name: "Quorb Dev", home_dir: ".quorb-dev", migrate_legacy: false };

pub fn current() -> &'static Profile {
    match option_env!("QUORB_IDENTIFIER").unwrap_or(STABLE.identifier) {
        "es.egdev.quorb" => &STABLE,
        "es.egdev.quorb.dev" => &DEV,
        _ => panic!("Unsupported Quorb build identity"),
    }
}

pub fn is_dev() -> bool { current().identifier == DEV.identifier }
pub fn home_root(home: &Path) -> PathBuf { home.join(current().home_dir) }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stable_identity_is_preserved_and_dev_is_disjoint() {
        assert_eq!(STABLE.identifier, "es.egdev.quorb");
        assert_eq!(STABLE.home_dir, ".quorb");
        assert_eq!(DEV.home_dir, ".quorb-dev");
        assert_ne!(DEV.identifier, STABLE.identifier);
        assert_ne!(DEV.name, STABLE.name);
        assert!(STABLE.migrate_legacy);
        assert!(!DEV.migrate_legacy);
    }
    #[test]
    fn runtime_owned_paths_follow_build_identity() {
        assert_eq!(home_root(Path::new("/home/test")), Path::new("/home/test").join(current().home_dir));
    }
}
