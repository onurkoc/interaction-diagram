# Interaction Diagram according to Eurocode 2
The source code for an interaction diagram for reinforced concrete sections according to EN 1992-1-1 is presented in this repository.

Works with Python 3.x

![Main_Screen](https://github.com/onurkoc/interaction-diagram/blob/master/images/Main_Screen.png)

👉 [View the Dash App](https://interaction-diagram.herokuapp.com/)

### How does it work?
- Either open up your Excel and type your (characteristical) normal force (n) and moment values (m) as shown below (they can be unlimited):<br>
Attention: Your file format should be .xlsx<br>
![Excel](https://github.com/onurkoc/interaction-diagram/blob/master/images/Excel.png)<br>
Feed this file to the dashed region per drag & drop<br>
- or feed a raw [ZSoil](https://www.zsoil.com/) .csv file per drag & drop to the dashed region
<br><br>
### Limiting Capacity
The limit of the capacity can also be activated using the radio buttons left below the screen.<br>
See minimum eccentricity e0=h/30 > 20mm EN1992-1-1 §6.1 (4)
<br><br>
### CULT-I
The concept CULT-I (Index for capacity utilization of linings in tunnels) is introduced in following scientific paper:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Published in: Geomechanics and Tunnelling 9 (2016), No.2<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Title: **Performance indicator of tunnel linings under geotechnical uncertainty**<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Authors: Spyridis, Panagiotis; Konstantis, Spyridon; Gakis, Angelos<br>

CULT-I is calculated using the following formula:<br>
*0 meaning totally utilized, 1 meaning no utilization at all!*<br>
![CULT-I_Formula](https://github.com/onurkoc/interaction-diagram/blob/master/images/Cult-I_formula.png)<br>

where<br>
![CULT-I](https://github.com/onurkoc/interaction-diagram/blob/master/images/Cult-I.png)<br>

### License
This project is licensed under the MIT License - see the [License](https://github.com/onurkoc/interaction-diagram/blob/master/LICENSE) for details
