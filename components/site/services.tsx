import { PHOTOS, SERVICE_GROUPS, type Photo } from "@/lib/site-content";
import { Pic } from "./pic";

/** Photos that belong to a group. They sit inside the closed details, so they are not fetched until someone opens the group. */
const GROUP_PHOTO: Partial<Record<string, Photo>> = {
  hospital: PHOTOS.ward,
  "lab-pharmacy": PHOTOS.laboratory,
};

/**
 * The services directory: seven groups, each a native details element. It opens and closes with the keyboard and with no JavaScript,
 * and home.css gives the opening a smooth height change.
 */
export function Services() {
  return (
    <div className="svc-list">
      {SERVICE_GROUPS.map((group) => {
        const photo = GROUP_PHOTO[group.id];
        return (
          <details key={group.id} className="svc" id={`service-${group.id}`}>
            <summary className="svc-head">
              <h3 className="svc-title">{group.title}</h3>
              <span className="svc-summary">{group.summary}</span>
              <span className="svc-chevron" aria-hidden="true" />
            </summary>
            <div className="svc-body">
              <div className="svc-inner">
                <div className="svc-content">
                  <ul className="svc-items">
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <div className="svc-text">
                    <p>{group.detail}</p>
                    {photo ? <Pic photo={photo} className="svc-photo" /> : null}
                  </div>
                </div>
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
