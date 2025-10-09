use std::env;

const MAIN_ENVIRONMENTS: [&str; 3] = ["development", "staging", "production"];

pub fn is_build() -> bool {
    env::var("GITHUB_ACTIONS").is_ok()
}

pub fn is_local() -> bool {
    env::var("SST_DEV").is_ok()
        || env::var("IS_LOCAL").is_ok()
        || matches!(env::var("IS_DEPLOYED_STAGE"), Ok(value) if value != "true")
}

pub fn environment() -> Option<String> {
    env::var("NODE_ENV")
        .ok()
        .filter(|value| MAIN_ENVIRONMENTS.contains(&value.as_str()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn env_helpers_work() {
        env::remove_var("SST_DEV");
        env::set_var("IS_DEPLOYED_STAGE", "preview");
        assert!(is_local());
        env::remove_var("IS_DEPLOYED_STAGE");
        assert!(!is_local());
    }
}
