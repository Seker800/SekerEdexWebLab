declare module "virtual:content-manifest" {
  import type { ContentManifest, ContentSourceDescriptor } from "./content/content-model.js";
  export const contentDelivery: "embedded" | "runtime";
  export const contentApiOrigin: string;
  export const contentSource: ContentSourceDescriptor;
  export const contentManifest: ContentManifest;
}
