# P.S. 💙

**A shared spatial correspondence experience for Snap SPECS.**

P.S. is designed around one pair of SPECS shared between trusted people in a shared physical space — a home, an apartment with roommates, a photography studio, or anywhere people share objects, routines, and knowledge.

One person creates a P.S. and places it where it matters. They can leave the SPECS behind for someone else, who picks them up later and discovers what was left for them.

The sender and recipient don't need to be in the same place at the same time.

A P.S. is not an AR sticky note. It is a media-rich spatial message that can hold text, voice, or visual media and receive a reply, allowing an exchange to continue through a place over time.

**Create → Place → Leave → Discover → Experience → Reply**

<!-- Add hero image or GIF here -->

<img width="1392" height="1892" alt="P S  Launch" src="https://github.com/user-attachments/assets/acb7136a-d873-4e51-90a3-0e2c3402e05c" />

<img width="1392" height="1892" alt="P S  Welcome Note" src="https://github.com/user-attachments/assets/b695cf1b-9d6a-465c-b52f-534ea58810e4" />


---

## Demo Flow

<!-- Add demo video, GIF, or screenshots here -->

<img width="1392" height="1892" alt="Demo Flow" src="https://github.com/user-attachments/assets/85212100-0d1b-4a73-b2e4-9d4e8f365166" />

<img width="1392" height="1892" alt="Demo 2 Flow 01" src="https://github.com/user-attachments/assets/67ae7e1a-23e7-410d-8ec5-586682a37e76" />

<img width="1392" height="1892" alt="Demo 2 Flow 02" src="https://github.com/user-attachments/assets/7be08efa-8a14-426e-a44c-d6fbe47c25d7" />

<img width="1392" height="1892" alt="Demo 2 Flow 03" src="https://github.com/user-attachments/assets/03121341-496f-4329-a5e5-26a9fc452322" />

<img width="1392" height="1892" alt="Demo 2 Flow 04" src="https://github.com/user-attachments/assets/5827adee-5c7c-44f5-bab7-d11eef3f3c2f" />

<img width="1392" height="1892" alt="Demo 2 Flow 05" src="https://github.com/user-attachments/assets/b8e1632e-3e04-4965-a1f1-6c94f5ecc786" />

---

## The Theme

The weekly theme was *Organize*: build a spatial experience that helps people organize, plan, or be more productive.

Most productivity tools organize information **on a screen**.

P.S. asks whether spatial computing can organize information around the real world instead.

In shared spaces, useful knowledge is constantly separated from the moment it becomes useful. A lighting setup gets explained in a text thread. Instructions for a house sitter become a long message sent hours before they arrive. A small detail someone will need tomorrow exists only in the memory of the person who knows it today.

P.S. puts that knowledge back into context — with the object, in the place, waiting for the person who needs it.

A photographer can leave context around a setup for whoever enters the studio next. A house sitter can discover guidance beside the thing it explains. A family member can leave something where another person will encounter it when the time is right.

P.S. isn't another place to organize notes.

> **It organizes the connection between information, place, time, and the person who needs it.**

---

## One Pair. More Than One Person.

P.S. starts with a simple idea: the person receiving a spatial experience does not need to own the hardware — or even be there when it is created.

A pair of SPECS might belong to one person, while the experiences created with them involve a partner, parent, child, roommate, friend, guest, collaborator, pet sitter, or house sitter.

Someone can create a P.S., leave the SPECS in the shared space, and go about their day.

Hours later, someone else picks them up.

> **There is something waiting for you.**

That small moment is part of the experience.

The recipient isn't simply being handed SPECS to try them. They're stepping into something another person intentionally prepared for them — even if that person is now somewhere else.

One pair can move between people at different moments, letting the experience extend beyond its owner without requiring everyone to have their own device.

P.S. explores how SPECS can become socially useful before they become socially ubiquitous.

---

## Correspondence That Belongs to a Place

Most digital communication is separated from the physical context — and often the moment — that gave it meaning.

A message about a camera ends up in a text thread instead of beside the camera.

Instructions for a plant live somewhere on a phone instead of waiting beside the plant when the person caring for it arrives.

The details of yesterday's studio setup have to be remembered and explained again tomorrow.

P.S. puts the message back with its context and lets it wait there until the right person arrives.

And it goes beyond attaching floating text to a location.

A P.S. is designed as a media-rich spatial object: something that can be discovered, opened, experienced, and replied to.

A sticky note annotates a place.

**P.S. lets people correspond through it — even when they pass through that place at different times.**

The reply remains connected to the original message, allowing an exchange to continue where it began rather than disappearing into another inbox or chat thread.

<!-- Add screenshot of an opened P.S. here -->

<!-- Add screenshot showing a reply here -->

---

## Built for the Spaces We Share 🌎

P.S. is designed for trusted spaces rather than as a public annotation layer covering the world.

These are places people may share without always occupying them together:

* 🏠 Homes where families, partners, and roommates can leave guidance, reminders, or something personal for one another to find later
* 🐕 Homes being cared for where pet and house sitters can discover instructions as they encounter the things those instructions relate to
* 🛏️ Guest spaces that can quietly explain themselves after the host has already left
* 📷 Photography studios where one person can finish for the day while leaving context around cameras, lighting setups, equipment, and works in progress for whoever arrives next
* 🎨 Workshops and creative spaces where tools, materials, and projects can carry knowledge from one person — and one session — to the next
* 🏡 Cabins, gardens, garages, and second homes shared between people whose visits may be hours, days, or weeks apart

Sometimes what is left behind is practical.

Sometimes it is personal.

Often it can be both.

> **Someone knows something that someone else will need, want, or appreciate later.**

P.S. gives it somewhere to stay until they get there.

---

## Built for SPECS

P.S. was created in Lens Studio for Snap SPECS as part of the Lenslist CLAD Summer Hackathon.

The prototype explores what becomes possible when lightweight augmented reality connects:

* one shared pair of SPECS
* people who already trust one another
* media-rich communication
* physical context
* different moments in time
* discovery and reply

The goal is not to add another layer competing with the physical world for attention.

It is to let the physical world become part of the communication — a place where something can be left by one person and found by another, later.

> **One pair of SPECS. The people you trust. The places you share. Something waiting for you.**

---

## Prototype Scope

The complete interaction loop is working in this Lens: creating a P.S., placing it, handing the experience to another person, discovering it, opening its media, and replying.

For a production version, P.S. would use Snap Cloud to persist conversation state, recordings, and spatial-anchor identifiers across Lens sessions. That would allow a sender to leave something behind, close the Lens, and have the recipient return later to the same continuing exchange.

Snap Cloud is currently available through limited alpha access, so for this hackathon the focus was on proving the core spatial experience and interaction model end to end.

The persistence layer can come later.

The experience itself is already here.

---

## Getting Started

Clone or download this repository and open:

`P.S. Demo 1.esproj`

in Lens Studio.

This repository contains the Lens Studio project and source files for the P.S. hackathon prototype.
